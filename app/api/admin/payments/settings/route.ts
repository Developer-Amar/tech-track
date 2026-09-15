import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/payments/settings
 * Allows admins to dynamically update event payment configuration:
 * - UPI ID (e.g. amardeveloper3@okhdfcbank)
 * - Payee Name (e.g. Tech Trek IEI x IETE)
 * - Require Payment For Event (boolean gate toggle)
 * - Payment Deadline (ISO timestamp)
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
    const { upiId, payeeName, requirePayment, deadline } = body;

    const updates: Record<string, any> = {};

    if (typeof upiId === "string") {
      const cleanUpi = upiId.trim();
      // UPI ID format check: typically user@bank (2 to 256 chars, exactly one @)
      if (!/^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z]{2,64}$/.test(cleanUpi)) {
        return NextResponse.json(
          { error: "Invalid UPI ID format. Expected format: username@bank (e.g. amardeveloper3@okhdfcbank)." },
          { status: 400 }
        );
      }
      updates.payment_upi_id = cleanUpi;
    }

    if (typeof payeeName === "string" && payeeName.trim()) {
      updates.payment_payee_name = payeeName.trim();
    }

    if (typeof requirePayment === "boolean") {
      updates.require_payment_for_event = requirePayment;
    }

    if (typeof deadline === "string" && deadline.trim()) {
      const parsedDate = new Date(deadline);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Invalid deadline date format." }, { status: 400 });
      }
      updates.payment_deadline = parsedDate.toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid settings provided to update." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: updatedSettings, error: updateError } = await admin
      .from("event_settings")
      .update(updates)
      .eq("id", 1)
      .select("payment_upi_id, payment_payee_name, require_payment_for_event, payment_deadline")
      .single();

    if (updateError) {
      console.error("Payment settings update error:", updateError);
      return NextResponse.json({ error: "Failed to update payment settings." }, { status: 500 });
    }

    // Audit log
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action_type: "PAYMENT_SETTINGS_UPDATED",
      action_detail: {
        admin_email: profile.email,
        updated_fields: updates,
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
      message: "Payment configuration updated successfully."
    });
  } catch (err: any) {
    console.error("Payment settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
