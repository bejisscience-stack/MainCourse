import {
  handleCors,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const cors = getCorsHeaders(req);

  // Only allow GET and PATCH
  if (req.method !== "GET" && req.method !== "PATCH") {
    return errorResponse("Method not allowed", 405, cors);
  }

  // Authenticate user
  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) {
    return auth.response;
  }
  const { user, supabase } = auth;

  if (req.method === "GET") {
    return handleGet(supabase, user.id, cors);
  } else {
    return handlePatch(req, supabase, user.id, cors);
  }
});

async function handleGet(
  supabase: ReturnType<
    typeof import("../_shared/supabase.ts").createServerSupabaseClient
  >,
  userId: string,
  cors: Record<string, string>,
) {
  try {
    // Get balance info using the RPC function
    const { data: balanceInfo, error: balanceError } = await supabase.rpc(
      "get_user_balance_info",
      { p_user_id: userId },
    );

    if (balanceError) {
      console.error("Error fetching balance info:", balanceError);
      return errorResponse("Failed to fetch balance information", 500, cors);
    }

    // Get recent transactions
    const { data: transactions, error: transError } = await supabase
      .from("balance_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (transError) {
      console.error("Error fetching transactions:", transError);
    }

    return jsonResponse(
      {
        balance: balanceInfo?.[0]?.balance || 0,
        bankAccountNumber: balanceInfo?.[0]?.bank_account_number || null,
        pendingWithdrawal: balanceInfo?.[0]?.pending_withdrawal || 0,
        totalEarned: balanceInfo?.[0]?.total_earned || 0,
        totalWithdrawn: balanceInfo?.[0]?.total_withdrawn || 0,
        transactions: transactions || [],
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("Error in GET /balance:", error);
    return errorResponse("Internal server error", 500, cors);
  }
}

async function handlePatch(
  req: Request,
  supabase: ReturnType<
    typeof import("../_shared/supabase.ts").createServerSupabaseClient
  >,
  userId: string,
  cors: Record<string, string>,
) {
  try {
    const body = await req.json();
    const { bankAccountNumber } = body;

    if (!bankAccountNumber || typeof bankAccountNumber !== "string") {
      return errorResponse("Bank account number is required", 400, cors);
    }

    // Validate Georgian IBAN format: GE + 2 digits + 2 letters + 16 digits
    const ibanUpper = bankAccountNumber.trim().toUpperCase();
    const georgianIbanPattern = /^GE[0-9]{2}[A-Z]{2}[0-9]{16}$/;

    if (!georgianIbanPattern.test(ibanUpper)) {
      return errorResponse(
        "Invalid Georgian IBAN format. Must be 22 characters: GE + 2 digits + 2 letters + 16 digits",
        400,
        cors,
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ bank_account_number: ibanUpper })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating bank account:", updateError);
      return errorResponse("Failed to update bank account number", 500, cors);
    }

    return jsonResponse(
      {
        success: true,
        bankAccountNumber: ibanUpper,
      },
      200,
      cors,
    );
  } catch (error) {
    console.error("Error in PATCH /balance:", error);
    return errorResponse("Internal server error", 500, cors);
  }
}
