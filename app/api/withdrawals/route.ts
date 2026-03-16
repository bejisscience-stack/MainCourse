import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET: Fetch user's withdrawal requests
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      console.error("Auth error in GET /api/withdrawals:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(token);

    const { data: requests, error } = await supabase
      .from("withdrawal_requests")
      .select(
        "id, user_id, amount, status, bank_account_number, admin_notes, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching withdrawal requests:", error);
      return NextResponse.json(
        { error: "Failed to fetch withdrawal requests" },
        { status: 500 },
      );
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    console.error("Error in GET /api/withdrawals:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST: Create a new withdrawal request
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      console.error("Auth error in POST /api/withdrawals:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, bankAccountNumber } = body;

    // Validate amount
    if (!amount || typeof amount !== "number" || amount < 0.1) {
      return NextResponse.json(
        { error: "Minimum withdrawal amount is 0.10 GEL" },
        { status: 400 },
      );
    }

    // Validate bank account — Georgian IBAN format (SEC-15)
    if (!bankAccountNumber || typeof bankAccountNumber !== "string") {
      return NextResponse.json(
        { error: "Bank account number is required" },
        { status: 400 },
      );
    }

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

    // Call the RPC function to create withdrawal request
    const { data: requestId, error: rpcError } = await supabase.rpc(
      "create_withdrawal_request",
      {
        p_amount: amount,
        p_bank_account_number: bankAccountNumber.trim(),
      },
    );

    if (rpcError) {
      console.error("Error creating withdrawal request:", rpcError);
      return NextResponse.json(
        { error: "Failed to create withdrawal request" },
        { status: 400 },
      );
    }

    // Fetch the created request
    const { data: withdrawalRequest, error: fetchError } = await supabase
      .from("withdrawal_requests")
      .select(
        "id, user_id, amount, status, bank_account_number, admin_notes, created_at, updated_at",
      )
      .eq("id", requestId)
      .single();

    if (fetchError || !withdrawalRequest) {
      console.error("Error fetching created request:", fetchError);
      return NextResponse.json(
        { error: "Failed to create withdrawal request" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        request: withdrawalRequest,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Error in POST /api/withdrawals:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
