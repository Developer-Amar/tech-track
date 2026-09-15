import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/payments/verify
 * Allows coordinators to verify or reject a team's UTR submission.
 * Verifying instantly grants event clearance and unlocks the game arena.
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
      .select("role, name, email")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { unitId, action, notes } = body;

    if (!unitId || !["verify", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid request. unitId and valid action ('verify' or 'reject') required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch unit to verify existence
    const { data: unit, error: unitError } = await admin
      .from("units")
      .select("id, name, payment_status, payment_utr, payment_amount")
      .eq("id", unitId)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    let updatePayload: Record<string, any> = {};

    if (action === "verify") {
      updatePayload = {
        payment_status: "verified",
        payment_verified_at: now,
        payment_verified_by: user.id,
        payment_notes: notes || null
      };
    } else {
      updatePayload = {
        payment_status: "rejected",
        payment_verified_at: null,
        payment_verified_by: user.id,
        payment_notes: notes || "Payment verification failed. Invalid or unverified UTR."
      };
    }

    const { error: updateError } = await admin
      .from("units")
      .update(updatePayload)
      .eq("id", unitId);

    if (updateError) {
      console.error("Payment verify update error:", updateError);
      return NextResponse.json({ error: "Failed to update payment status." }, { status: 500 });
    }

    // 2. Audit logging
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: action === "verify" ? "PAYMENT_VERIFIED" : "PAYMENT_REJECTED",
      action_detail: {
        unit_id: unit.id,
        unit_name: unit.name,
        admin_email: profile.email,
        admin_name: profile.name,
        utr: unit.payment_utr,
        amount: unit.payment_amount,
        notes: notes || null,
        timestamp: now
      }
    });

    return NextResponse.json({
      success: true,
      unitId,
      payment_status: updatePayload.payment_status,
      message: action === "verify" 
        ? `Team ${unit.name} has been verified and cleared for the event.`
        : `Team ${unit.name}'s payment has been rejected.`
    });
  } catch (err: any) {
    console.error("Payment verify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
