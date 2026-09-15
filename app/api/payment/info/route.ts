import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/payment/info
 * Returns the current user's team payment clearance details, member count,
 * calculated fee (₹50/head), UTR submission info, and event UPI config.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Find user's accepted team membership
    const { data: membership, error: memError } = await admin
      .from("unit_members")
      .select("unit_id")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (memError || !membership) {
      return NextResponse.json({
        hasTeam: false,
        message: "No active team found. Join or create a team first."
      });
    }

    // 2. Fetch unit details
    const { data: unit, error: unitError } = await admin
      .from("units")
      .select(`
        id,
        name,
        leader_id,
        locked,
        payment_status,
        payment_amount,
        payment_utr,
        payment_submitted_at,
        payment_verified_at,
        payment_notes
      `)
      .eq("id", membership.unit_id)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: "Team record not found" }, { status: 404 });
    }

    // 3. Fetch all accepted members of this team
    const { data: rawMembers } = await admin
      .from("unit_members")
      .select(`
        user_id,
        users:user_id (id, name, email, avatar_url)
      `)
      .eq("unit_id", unit.id)
      .eq("status", "accepted");

    const acceptedMembers = (rawMembers || []).map((m: any) => ({
      id: m.users?.id || m.user_id,
      name: m.users?.name || "Team Member",
      email: m.users?.email || "",
      avatar_url: m.users?.avatar_url || null,
      isLeader: m.users?.id === unit.leader_id
    }));

    const memberCount = acceptedMembers.length;
    // Pricing rule: ₹50 per person (2 members = ₹100, 3 = ₹150, 4 = ₹200)
    const calculatedAmount = Math.max(memberCount * 50, 100);

    // 4. Fetch payment settings
    const { data: settings } = await admin
      .from("event_settings")
      .select("payment_upi_id, payment_payee_name, require_payment_for_event, payment_deadline")
      .eq("id", 1)
      .maybeSingle();

    const isLeader = unit.leader_id === user.id;

    return NextResponse.json({
      hasTeam: true,
      unit: {
        id: unit.id,
        name: unit.name,
        leader_id: unit.leader_id,
        locked: unit.locked,
        payment_status: unit.payment_status || "unpaid",
        payment_amount: unit.payment_amount || calculatedAmount,
        payment_utr: unit.payment_utr || null,
        payment_submitted_at: unit.payment_submitted_at || null,
        payment_verified_at: unit.payment_verified_at || null,
        payment_notes: unit.payment_notes || null
      },
      members: acceptedMembers,
      memberCount,
      requiredAmount: calculatedAmount,
      isLeader,
      settings: {
        payment_upi_id: settings?.payment_upi_id || "amardeveloper3@okhdfcbank",
        payment_payee_name: settings?.payment_payee_name || "Tech Trek IEI x IETE",
        require_payment_for_event: settings?.require_payment_for_event ?? true,
        payment_deadline: settings?.payment_deadline || "2026-09-30T11:00:00+05:30"
      }
    });
  } catch (err: any) {
    console.error("Payment info error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
