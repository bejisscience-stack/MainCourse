import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET: Fetch user's balance information
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      console.error("Auth error in GET /api/balance:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(token);

    // Fetch balance info and recent transactions in parallel
    const [balanceResult, transResult] = await Promise.all([
      supabase.rpc("get_user_balance_info", { p_user_id: user.id }),
      supabase
        .from("balance_transactions")
        .select(
          "id, user_id, type, amount, description, reference_id, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const { data: balanceInfo, error: balanceError } = balanceResult;
    const { data: transactions, error: transError } = transResult;

    if (balanceError) {
      console.error("Error fetching balance info:", balanceError);
      return NextResponse.json(
        { error: "Failed to fetch balance information" },
        { status: 500 },
      );
    }

    if (transError) {
      console.error("Error fetching transactions:", transError);
    }

    return NextResponse.json({
      balance: balanceInfo?.[0]?.balance || 0,
      bankAccountNumber: balanceInfo?.[0]?.bank_account_number || null,
      pendingWithdrawal: balanceInfo?.[0]?.pending_withdrawal || 0,
      totalEarned: balanceInfo?.[0]?.total_earned || 0,
      totalWithdrawn: balanceInfo?.[0]?.total_withdrawn || 0,
      transactions: transactions || [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/balance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH: Update bank account number
export async function PATCH(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      console.error("Auth error in PATCH /api/balance:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bankAccountNumber } = body;

    if (!bankAccountNumber || typeof bankAccountNumber !== "string") {
      return NextResponse.json(
        { error: "Bank account number is required" },
        { status: 400 },
      );
    }

    // Validate Georgian IBAN format
    const ibanUpper = bankAccountNumber.trim().toUpperCase();
    const georgianIbanPattern = /^GE[0-9]{2}[A-Z]{2}[0-9]{16}$/;

    if (!georgianIbanPattern.test(ibanUpper)) {
      return NextResponse.json(
        {
          error:
            "Invalid Georgian IBAN format. Must be 22 characters: GE + 2 digits + 2 letters + 16 digits",
        },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient(token);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ bank_account_number: ibanUpper })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating bank account:", updateError);
      return NextResponse.json(
        { error: "Failed to update bank account number" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      bankAccountNumber: ibanUpper,
    });
  } catch (error: any) {
    console.error("Error in PATCH /api/balance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
