import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payments
 * Fetches all teams' payment status, revenue analytics, and active payment configuration.
 * Restricted to admins and super_admins.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const admin = createAdminClient();

    // 1. Fetch event payment settings
    const { data: settings } = await admin
      .from("event_settings")
      .select("payment_upi_id, payment_payee_name, require_payment_for_event, payment_deadline")
      .eq("id", 1)
      .maybeSingle();

    // 2. Fetch all units with their leader info and member counts
    const { data: rawUnits, error: unitsError } = await admin
      .from("units")
      .select(`
        id,
        name,
        leader_id,
        locked,
        disqualified,
        payment_status,
        payment_amount,
        payment_utr,
        payment_submitted_at,
        payment_verified_at,
        payment_verified_by,
        payment_notes,
        created_at,
        leader:leader_id (id, name, email),
        verifier:payment_verified_by (id, name, email)
      `)
      .order("payment_submitted_at", { ascending: false, nullsFirst: false });

    if (unitsError) {
      console.error("Fetch units error:", unitsError);
      return NextResponse.json({ error: "Failed to fetch units" }, { status: 500 });
    }

    // 3. Fetch member counts for each unit
    const { data: members } = await admin
      .from("unit_members")
      .select("unit_id, status")
      .eq("status", "accepted");

    const memberCounts: Record<string, number> = {};
    (members || []).forEach((m) => {
      memberCounts[m.unit_id] = (memberCounts[m.unit_id] || 0) + 1;
    });

    const units = (rawUnits || []).map((u: any) => {
      const count = memberCounts[u.id] || 2;
      const amount = u.payment_amount || count * 50;
      return {
        id: u.id,
        name: u.name,
        leader_id: u.leader_id,
        leader_name: u.leader?.name || "Unknown",
        leader_email: u.leader?.email || "N/A",
        locked: u.locked,
        disqualified: u.disqualified,
        payment_status: u.payment_status || "unpaid",
        payment_amount: amount,
        payment_utr: u.payment_utr,
        payment_submitted_at: u.payment_submitted_at,
        payment_verified_at: u.payment_verified_at,
        payment_verified_by_name: u.verifier?.name || null,
        payment_notes: u.payment_notes,
        member_count: count,
        created_at: u.created_at
      };
    });

    // 4. Compute Financial & Operational Metrics
    let totalRevenue = 0;
    let expectedRevenue = 0;
    let verifiedCount = 0;
    let pendingCount = 0;
    let unpaidCount = 0;
    let rejectedCount = 0;

    units.forEach((u) => {
      expectedRevenue += u.payment_amount;
      if (u.payment_status === "verified") {
        totalRevenue += u.payment_amount;
        verifiedCount++;
      } else if (u.payment_status === "pending") {
        pendingCount++;
      } else if (u.payment_status === "rejected") {
        rejectedCount++;
      } else {
        unpaidCount++;
      }
    });

    return NextResponse.json({
      stats: {
        totalUnits: units.length,
        verifiedCount,
        pendingCount,
        unpaidCount,
        rejectedCount,
        totalRevenue,
        expectedRevenue
      },
      units,
      settings: {
        payment_upi_id: settings?.payment_upi_id || "amardeveloper3@okhdfcbank",
        payment_payee_name: settings?.payment_payee_name || "Tech Trek IEI x IETE",
        require_payment_for_event: settings?.require_payment_for_event ?? true,
        payment_deadline: settings?.payment_deadline || "2026-09-30T11:00:00+05:30"
      }
    });
  } catch (err: any) {
    console.error("Admin payments GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
