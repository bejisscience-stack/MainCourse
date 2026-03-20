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

  // Only allow GET and POST
  if (req.method !== "GET" && req.method !== "POST") {
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
    return handlePost(req, supabase, cors);
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
    const { data: requests, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching withdrawal requests:", error);
      return errorResponse("Failed to fetch withdrawal requests", 500, cors);
    }

    return jsonResponse({ requests: requests || [] }, 200, cors);
  } catch (error) {
    console.error("Error in GET /withdrawals:", error);
    return errorResponse("Internal server error", 500, cors);
  }
}

async function handlePost(
  req: Request,
  supabase: ReturnType<
    typeof import("../_shared/supabase.ts").createServerSupabaseClient
  >,
  cors: Record<string, string>,
) {
  try {
    const body = await req.json();
    const { amount, bankAccountNumber } = body;

    // Fetch dynamic minimum withdrawal from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("min_withdrawal_gel")
      .limit(1)
      .single();
    const minWithdrawal = settings?.min_withdrawal_gel ?? 50;

    // Validate amount
    if (!amount || typeof amount !== "number" || amount < minWithdrawal) {
      return errorResponse(
        `Minimum withdrawal amount is ${minWithdrawal} GEL`,
        400,
        cors,
      );
    }

    // Validate bank account
    if (
      !bankAccountNumber ||
      typeof bankAccountNumber !== "string" ||
      bankAccountNumber.trim().length < 10
    ) {
      return errorResponse("Valid bank account number is required", 400, cors);
    }

    // Call the RPC function to create withdrawal request
    // This RPC validates user has sufficient balance
    const { data: requestId, error: rpcError } = await supabase.rpc(
      "create_withdrawal_request",
      {
        p_amount: amount,
        p_bank_account_number: bankAccountNumber.trim(),
      },
    );

    if (rpcError) {
      console.error("Error creating withdrawal request:", rpcError);
      return jsonResponse(
        { error: rpcError.message || "Failed to create withdrawal request" },
        400,
        cors,
      );
    }

    // Fetch the created request
    const { data: withdrawalRequest, error: fetchError } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !withdrawalRequest) {
      console.error("Error fetching created request:", fetchError);
      return errorResponse("Failed to create withdrawal request", 500, cors);
    }

    return jsonResponse(
      {
        success: true,
        request: withdrawalRequest,
      },
      201,
      cors,
    );
  } catch (error) {
    console.error("Error in POST /withdrawals:", error);
    return errorResponse("Internal server error", 500, cors);
  }
}
