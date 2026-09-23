import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Clean roll numbers to conform with Chitkara's 10-char limit
 */
function sanitizeRollNo(raw: string | null | undefined): string {
  if (!raw) return "2310990000";
  // Strip spaces, dashes, brackets, and extra notes
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(0, 10);
}

/**
 * Clean phone numbers to conform with Chitkara's 10-15 digit limit (no +91 prefix)
 */
function sanitizePhone(raw: string | null | undefined): string {
  if (!raw) return "9876543210";
  const digits = raw.replace(/\D/g, "");
  // If starts with 91 and has 12 digits, strip country code
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits.slice(0, 15) || "9876543210";
}

/**
 * POST /api/payment/chitkara/relay
 * Express 1-Click Checkout Relay:
 * Auto-registers team details directly into Chitkara University's MySQL server (esend.php)
 * and retrieves the encrypted ICICI Bank EazyPay gateway payload (request.php).
 */
export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
      return NextResponse.json(
        { error: "You must be part of an accepted team to initiate payment." },
        { status: 400 }
      );
    }

    // 2. Fetch unit details
    const { data: unit, error: unitError } = await admin
      .from("units")
      .select("id, name, leader_id, payment_status, chitkara_order_token")
      .eq("id", membership.unit_id)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: "Team record not found." }, { status: 404 });
    }

    // 3. Strict Leader Check
    if (unit.leader_id !== user.id) {
      return NextResponse.json(
        { error: "Access Denied: Only the Team Leader is authorized to initiate payment on the Chitkara portal." },
        { status: 403 }
      );
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
      return NextResponse.json(
        { error: "Your team must have at least 2 accepted members to complete payment." },
        { status: 400 }
      );
    }

    const memberCount = rawMembers.length;
    if (memberCount > 4) {
      return NextResponse.json(
        { error: "Maximum team size is 4 members." },
        { status: 400 }
      );
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

    // Append dynamic member array fields
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

    // 6. Relay POST to Chitkara esend.php
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
      return NextResponse.json(
        { error: `Chitkara payment server returned HTTP ${esendResponse.status}. Please try again.` },
        { status: 502 }
      );
    }

    const esendHtml = await esendResponse.text();

    // Check for error in response
    const errMatch = esendHtml.match(/getErrMsg\('([^']+)'\)/);
    if (errMatch) {
      return NextResponse.json(
        { error: `Chitkara portal validation error: ${errMatch[1]}` },
        { status: 400 }
      );
    }

    // Extract registration token (e.g. parent.getSendRequest('b5c9ab...'))
    const tokenMatch = esendHtml.match(/getSendRequest\('([^']+)'\)/);
    if (!tokenMatch) {
      console.error("Failed to parse Chitkara token from response:", esendHtml);
      return NextResponse.json(
        { error: "Could not initialize registration with Chitkara portal. Please try again." },
        { status: 502 }
      );
    }

    const registrationToken = tokenMatch[1];

    // 7. Request encrypted ICICI EazyPay form payload from request.php
    const requestUrl = "https://paym.chitkara.edu.in/online-chitkara-events/tech-trek-2.O/request.php";
    const reqResponse = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TechTrek/2.0"
      },
      body: new URLSearchParams({ idA: registrationToken }).toString()
    });

    if (!reqResponse.ok) {
      return NextResponse.json(
        { error: "Failed to connect to bank gateway processor." },
        { status: 502 }
      );
    }

    const reqHtml = await reqResponse.text();

    // Parse ICICI form action URL
    const actionMatch = reqHtml.match(/action='([^']+)'/);
    const iciciUrl = actionMatch ? actionMatch[1] : "https://eazypay.icicibank.com/EazyPG";

    // Extract all hidden inputs generated by Chitkara for ICICI Bank
    const fieldRegex = /name='([^']+)'\s+value='([^']*)'/g;
    const fields: { name: string; value: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = fieldRegex.exec(reqHtml)) !== null) {
      fields.push({ name: match[1], value: match[2] });
    }

    if (fields.length === 0) {
      console.error("ICICI fields extraction failed:", reqHtml);
      return NextResponse.json(
        { error: "Unable to retrieve payment gateway parameters from bank." },
        { status: 502 }
      );
    }

    // Save token on unit for reconciliation
    await admin
      .from("units")
      .update({
        chitkara_order_token: registrationToken
      })
      .eq("id", unit.id);

    return NextResponse.json({
      success: true,
      iciciUrl,
      fields,
      registrationToken,
      amount: parseInt(paymentAmount),
      memberCount,
      teamName: unit.name
    });
  } catch (err: any) {
    console.error("Chitkara relay error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while communicating with Chitkara portal." },
      { status: 500 }
    );
  }
}
