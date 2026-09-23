import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/payment/submit
 * Allows the Team Leader to submit their 12-digit UPI UTR transaction reference.
 * Enforces strict authorization, duplicate prevention, regex sanitization, and audit logging.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawUtr = body.transactionId || body.utr;

    if (!rawUtr || typeof rawUtr !== "string") {
      return NextResponse.json(
        { error: "Chitkara Transaction ID / Reference is required." },
        { status: 400 }
      );
    }

    // 1. Sanitize and Validate Format (Supports Chitkara Transaction IDs & Bank UTRs)
    const cleanUtr = rawUtr.trim().toUpperCase();
    const utrRegex = /^[A-Z0-9_\-]{6,40}$/;
    if (!utrRegex.test(cleanUtr)) {
      return NextResponse.json(
        {
          error: "Invalid reference format. Must be 6 to 40 alphanumeric characters (e.g., Chitkara Transaction ID or ICICI Ref No)."
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 2. Fetch caller's accepted unit membership
    const { data: membership, error: memError } = await admin
      .from("unit_members")
      .select("unit_id")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (memError || !membership) {
      return NextResponse.json(
        { error: "You must belong to an accepted team to submit payment." },
        { status: 400 }
      );
    }

    // 3. Fetch unit details
    const { data: unit, error: unitError } = await admin
      .from("units")
      .select("id, name, leader_id, payment_status, payment_utr")
      .eq("id", membership.unit_id)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: "Team record not found." }, { status: 404 });
    }

    // 4. Strict Authorization: Only the Team Leader can submit payment
    if (unit.leader_id !== user.id) {
      return NextResponse.json(
        { error: "Access Denied: Only the designated Team Leader can submit payment clearance." },
        { status: 403 }
      );
    }

    // 5. Verification Guard: Disallow overwriting if already verified
    if (unit.payment_status === "verified") {
      return NextResponse.json(
        { error: "Team payment has already been verified and operational clearance granted." },
        { status: 400 }
      );
    }

    // 6. Anti-Replay Duplicate Check: Check if UTR is already used by another team
    const { data: existingUnit } = await admin
      .from("units")
      .select("id, name")
      .eq("payment_utr", cleanUtr)
      .neq("id", unit.id)
      .maybeSingle();

    if (existingUnit) {
      return NextResponse.json(
        {
          error: "This UTR transaction reference has already been submitted by another team. Duplicate submissions are strictly audited and rejected."
        },
        { status: 409 }
      );
    }

    // 7. Calculate fee based on accepted members
    const { count: memberCount } = await admin
      .from("unit_members")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unit.id)
      .eq("status", "accepted");

    const count = memberCount || 2;
    const calculatedAmount = count * 50;

    // 8. Update unit with pending payment and UTR
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("units")
      .update({
        payment_status: "pending",
        payment_utr: cleanUtr,
        chitkara_txn_id: cleanUtr,
        payment_amount: calculatedAmount,
        payment_submitted_at: now,
        payment_notes: null
      })
      .eq("id", unit.id);

    if (updateError) {
      console.error("Payment submission update error:", updateError);
      return NextResponse.json(
        { error: "Failed to record payment submission. Please try again." },
        { status: 500 }
      );
    }

    // 9. Write to Audit Log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "PAYMENT_UTR_SUBMITTED",
      action_detail: {
        unit_id: unit.id,
        unit_name: unit.name,
        utr: cleanUtr,
        amount: calculatedAmount,
        member_count: count,
        submitted_at: now
      }
    });

    return NextResponse.json({
      success: true,
      message: "Payment reference submitted successfully. Status is now PENDING coordinator verification.",
      payment_status: "pending",
      payment_utr: cleanUtr,
      payment_amount: calculatedAmount,
      submitted_at: now
    });
  } catch (err: any) {
    console.error("Payment submit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
