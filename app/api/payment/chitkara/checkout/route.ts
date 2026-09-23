import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Clean roll numbers to conform with Chitkara's 10-char limit
 */
function sanitizeRollNo(raw: string | null | undefined): string {
  if (!raw) return "2310990000";
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(0, 10);
}

/**
 * Clean phone numbers to conform with Chitkara's 10-15 digit limit (no +91 prefix)
 */
function sanitizePhone(raw: string | null | undefined): string {
  if (!raw) return "9876543210";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits.slice(0, 15) || "9876543210";
}

/**
 * GET /api/payment/chitkara/checkout
 * Express 1-Click Native Checkout:
 * Automatically pre-registers the team into Chitkara University's MySQL system
 * and immediately redirects the browser via HTTP 302 to Chitkara's bank request handler,
 * which auto-submits natively to ICICI Bank EazyPay (UPI QR, Cards, NetBanking).
 *
 * Zero popup-blocker issues, zero manual data entry, zero tab switching!
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(`${origin}/login?error=not_authenticated`, 302);
    }

    const admin = createAdminClient();

    // 1. Fetch user's accepted team membership
    const { data: membership, error: memError } = await admin
      .from("unit_members")
      .select("unit_id")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (memError || !membership) {
      return NextResponse.redirect(`${origin}/dashboard?error=no_active_team`, 302);
    }

    // 2. Fetch unit details
    const { data: unit, error: unitError } = await admin
      .from("units")
      .select("id, name, leader_id, payment_status, chitkara_order_token")
      .eq("id", membership.unit_id)
      .single();

    if (unitError || !unit) {
      return NextResponse.redirect(`${origin}/dashboard?error=team_not_found`, 302);
    }

    // 3. Strict Leader Check
    if (unit.leader_id !== user.id) {
      return NextResponse.redirect(`${origin}/dashboard?error=leader_only_payment`, 302);
    }

    // 4. Fetch all accepted members
    const { data: rawMembers, error: membersError } = await admin
      .from("unit_members")
      .select(`
        user_id,
        users:user_id (id, name, email, roll_no, mobile_number, branch)
      `)
      .eq("unit_id", unit.id)
      .eq("status", "accepted");

    if (membersError || !rawMembers || rawMembers.length < 2) {
      return NextResponse.redirect(`${origin}/dashboard?error=min_members_required`, 302);
    }

    const memberCount = rawMembers.length;
    if (memberCount > 4) {
      return NextResponse.redirect(`${origin}/dashboard?error=max_members_exceeded`, 302);
    }

    // Find leader profile
    const leaderRow = rawMembers.find((m: any) => m.user_id === user.id) || rawMembers[0];
    const leaderUser = (leaderRow as any).users || {};

    const leaderName = (leaderUser.name || "Team Leader").trim().slice(0, 50);
    const leaderRoll = sanitizeRollNo(leaderUser.roll_no);
    const leaderEmail = (leaderUser.email || user.email || "").trim();
    const leaderPhone = sanitizePhone(leaderUser.mobile_number);
    const leaderDept = (leaderUser.branch || "Engineering").trim().slice(0, 30);
    const paymentAmount = String(memberCount * 50);

    // 5. Build URL-encoded form data for Chitkara esend.php
    const formParams = new URLSearchParams();
    formParams.append("lId", "");
    formParams.append("name", leaderName);
    formParams.append("rollNo", leaderRoll);
    formParams.append("email", leaderEmail);
    formParams.append("contactNo", leaderPhone);
    formParams.append("department", leaderDept);
    formParams.append("memberCount", String(memberCount));
    formParams.append("paymentAmount", paymentAmount);

    // Dynamic member array fields
    rawMembers.forEach((m: any, index: number) => {
      const u = m.users || {};
      const mName = (u.name || `Member ${index + 1}`).trim().slice(0, 50);
      const mRoll = sanitizeRollNo(u.roll_no);
      const mEmail = (u.email || `member${index + 1}@chitkara.edu.in`).trim();
      const mPhone = sanitizePhone(u.mobile_number);

      formParams.append(`memberName[${index}]`, mName);
      formParams.append(`memberRollNo[${index}]`, mRoll);
      formParams.append(`memberEmail[${index}]`, mEmail);
      formParams.append(`memberPhone[${index}]`, mPhone);
    });

    // 6. Relay pre-registration directly to Chitkara's esend.php
    const esendUrl = "https://paym.chitkara.edu.in/online-chitkara-events/tech-trek-2.O/esend.php";
    const esendResponse = await fetch(esendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TechTrek/2.0"
      },
      body: formParams.toString()
    });

    if (!esendResponse.ok) {
      return NextResponse.redirect(`${origin}/dashboard?error=chitkara_server_unavailable`, 302);
    }

    const esendHtml = await esendResponse.text();

    // Check for university validation error
    const errMatch = esendHtml.match(/getErrMsg\('([^']+)'\)/);
    if (errMatch) {
      console.error("Chitkara validation error:", errMatch[1]);
      return NextResponse.redirect(
        `${origin}/dashboard?error=chitkara_validation_${encodeURIComponent(errMatch[1])}`,
        302
      );
    }

    // Extract registration token (e.g. parent.getSendRequest('b5c9ab...'))
    const tokenMatch = esendHtml.match(/getSendRequest\('([^']+)'\)/);
    if (!tokenMatch) {
      console.error("Failed to parse Chitkara token from response:", esendHtml);
      return NextResponse.redirect(`${origin}/dashboard?error=token_parse_failed`, 302);
    }

    const registrationToken = tokenMatch[1];

    // Save token on unit for reconciliation & audit
    await admin
      .from("units")
      .update({
        chitkara_order_token: registrationToken
      })
      .eq("id", unit.id);

    // 7. Direct HTTP 302 redirect to Chitkara request.php?idA={token}
    // Chitkara request.php will instantly auto-submit to ICICI EazyPG within the same window
    const targetUrl = `https://paym.chitkara.edu.in/online-chitkara-events/tech-trek-2.O/request.php?idA=${registrationToken}`;
    return NextResponse.redirect(targetUrl, 302);
  } catch (err: any) {
    console.error("Chitkara checkout route exception:", err);
    return NextResponse.redirect(`${origin}/dashboard?error=internal_checkout_error`, 302);
  }
}
