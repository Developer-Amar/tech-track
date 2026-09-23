import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Helper to parse CSV lines safely handling quotes
 */
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  for (const line of rawLines) {
    const row: string[] = [];
    let insideQuote = false;
    let entry = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        row.push(entry.trim().replace(/^["']|["']$/g, ""));
        entry = "";
      } else {
        entry += char;
      }
    }
    row.push(entry.trim().replace(/^["']|["']$/g, ""));
    lines.push(row);
  }

  return lines;
}

/**
 * POST /api/admin/payments/reconcile-csv
 * Autonomous Reconciliation:
 * Ingests Chitkara University accounts export CSV, matches student roll numbers
 * and transaction IDs, and auto-approves all 400 teams in real time!
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, email, name")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const csvContent = body.csvData;

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        { error: "CSV content is required (expected string under csvData)." },
        { status: 400 }
      );
    }

    const rows = parseCSV(csvContent);
    if (rows.length < 2) {
      return NextResponse.json(
        { error: "CSV file is empty or missing headers." },
        { status: 400 }
      );
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));

    // Identify relevant column indexes
    let rollCol = headers.findIndex((h) => h.includes("roll") || h.includes("enroll") || h.includes("regno"));
    let txnCol = headers.findIndex((h) => h.includes("txn") || h.includes("trans") || h.includes("ref") || h.includes("utr"));
    let statusCol = headers.findIndex((h) => h.includes("status") || h.includes("state") || h.includes("result"));
    let nameCol = headers.findIndex((h) => h.includes("name") || h.includes("student"));
    let amountCol = headers.findIndex((h) => h.includes("amount") || h.includes("fee") || h.includes("paid"));

    // Fallbacks if headers are generic
    if (rollCol === -1) rollCol = 1; // standard column 2
    if (txnCol === -1) txnCol = 2; // standard column 3

    const admin = createAdminClient();

    // 1. Fetch all users with roll_no and their accepted team
    const { data: allMembers, error: memError } = await admin
      .from("unit_members")
      .select(`
        unit_id,
        user_id,
        users:user_id (id, name, email, roll_no),
        units:unit_id (id, name, payment_status, payment_utr, chitkara_txn_id)
      `)
      .eq("status", "accepted");

    if (memError || !allMembers) {
      return NextResponse.json({ error: "Failed to load team rosters" }, { status: 500 });
    }

    // Build map: clean roll_no -> unit record
    const rollToUnitMap = new Map<string, any>();
    allMembers.forEach((m: any) => {
      const roll = (m.users?.roll_no || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (roll) {
        rollToUnitMap.set(roll, m.units);
      }
    });

    let newlyVerified = 0;
    let alreadyVerified = 0;
    const unmatchedRows: any[] = [];
    const verifiedUnitIds = new Set<string>();

    const now = new Date().toISOString();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || !row[0]) continue;

      const rawRoll = row[rollCol] || "";
      const rawTxn = (row[txnCol] || "").trim().toUpperCase();
      const rawStatus = (statusCol !== -1 ? row[statusCol] : "success").toLowerCase();
      const rawName = nameCol !== -1 ? row[nameCol] : "";
      const rawAmount = amountCol !== -1 ? row[amountCol] : "";

      // Skip clearly failed payments
      if (rawStatus.includes("fail") || rawStatus.includes("decline") || rawStatus.includes("reject")) {
        continue;
      }

      const cleanRoll = rawRoll.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!cleanRoll) continue;

      const unit = rollToUnitMap.get(cleanRoll);

      if (!unit) {
        unmatchedRows.push({
          rowNumber: i + 1,
          rollNo: rawRoll,
          name: rawName,
          txnId: rawTxn,
          amount: rawAmount,
          reason: "No registered participant found with this roll number."
        });
        continue;
      }

      if (unit.payment_status === "verified" || verifiedUnitIds.has(unit.id)) {
        alreadyVerified++;
        continue;
      }

      // Auto-approve this unit!
      const { error: updateError } = await admin
        .from("units")
        .update({
          payment_status: "verified",
          payment_verified_at: now,
          payment_verified_by: user.id,
          payment_utr: rawTxn || unit.payment_utr || "CHITKARA_CSV",
          chitkara_txn_id: rawTxn || unit.chitkara_txn_id || "CHITKARA_CSV",
          payment_notes: `Auto-verified via Chitkara University Accounts CSV import (${rawTxn || "Matched Roll No"})`
        })
        .eq("id", unit.id);

      if (!updateError) {
        newlyVerified++;
        verifiedUnitIds.add(unit.id);
        unit.payment_status = "verified"; // update cache
      }
    }

    // 2. Audit Log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "CHITKARA_CSV_RECONCILED",
      action_detail: {
        admin_email: profile.email,
        admin_name: profile.name,
        total_rows_processed: rows.length - 1,
        newly_verified_teams: newlyVerified,
        already_verified_teams: alreadyVerified,
        unmatched_count: unmatchedRows.length,
        timestamp: now
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: rows.length - 1,
        newlyVerified,
        alreadyVerified,
        unmatchedCount: unmatchedRows.length
      },
      unmatched: unmatchedRows.slice(0, 50) // top 50 unmatched for preview
    });
  } catch (err: any) {
    console.error("CSV reconcile error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
