import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import {
  verifyAdminRequest,
  isAuthError,
  getTokenFromHeader,
  internalError,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Default fallbacks if settings table is empty
const DEFAULTS = {
  min_withdrawal_gel: 50,
  subscription_price_gel: 10,
};

/**
 * GET /api/admin/settings
 * Any authenticated user can read platform settings (needed by client components)
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(token);
    const { data, error } = await supabase
      .from("platform_settings")
      .select(
        "min_withdrawal_gel, subscription_price_gel, updated_at, updated_by",
      )
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults if table is empty or not yet migrated
      return NextResponse.json(DEFAULTS);
    }

    return NextResponse.json(data);
  } catch (err) {
    return internalError("Admin Settings GET", err);
  }
}

/**
 * PUT /api/admin/settings
 * Admin-only: update platform settings
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) return authResult;

    const { userId, token } = authResult;

    // Use user-scoped client — RLS policy allows admin updates
    const supabase = createServerSupabaseClient(token);

    const body = await request.json();
    const { min_withdrawal_gel, subscription_price_gel } = body;

    // Validate: at least one field must be provided
    if (
      min_withdrawal_gel === undefined &&
      subscription_price_gel === undefined
    ) {
      return NextResponse.json(
        { error: "No settings provided to update" },
        { status: 400 },
      );
    }

    // Validate values
    if (min_withdrawal_gel !== undefined) {
      const val = Number(min_withdrawal_gel);
      if (isNaN(val) || val <= 0) {
        return NextResponse.json(
          { error: "min_withdrawal_gel must be a positive number" },
          { status: 400 },
        );
      }
    }
    if (subscription_price_gel !== undefined) {
      const val = Number(subscription_price_gel);
      if (isNaN(val) || val <= 0) {
        return NextResponse.json(
          { error: "subscription_price_gel must be a positive number" },
          { status: 400 },
        );
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };
    if (min_withdrawal_gel !== undefined) {
      updateData.min_withdrawal_gel = Number(min_withdrawal_gel);
    }
    if (subscription_price_gel !== undefined) {
      updateData.subscription_price_gel = Number(subscription_price_gel);
    }

    // Update the singleton row (filter required by PostgREST)
    const { data, error } = await supabase
      .from("platform_settings")
      .update(updateData)
      .not("id", "is", null)
      .select(
        "min_withdrawal_gel, subscription_price_gel, updated_at, updated_by",
      )
      .single();

    if (error) {
      console.error(
        "[Admin Settings PUT] Update error:",
        error.message,
        error.code,
        error.details,
      );
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return internalError("Admin Settings PUT", err);
  }
}
