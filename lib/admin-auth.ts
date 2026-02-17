import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

interface AdminAuthResult {
  token: string;
  userId: string;
  serviceSupabase: ReturnType<typeof createServiceRoleClient>;
}

/**
 * Shared admin auth check for API routes.
 * Verifies the Bearer token, checks admin role, and returns a service-role Supabase client.
 * Returns a NextResponse error if auth fails, or the auth context on success.
 */
export async function verifyAdminRequest(
  request: NextRequest
): Promise<AdminAuthResult | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { user, error: userError } = await verifyTokenAndGetUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient(token);

  try {
    const { data, error } = await supabase.rpc('check_is_admin', { user_id: user.id });
    if (error || data !== true) {
      return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Access denied. Admin only.' }, { status: 403 });
  }

  return {
    token,
    userId: user.id,
    serviceSupabase: createServiceRoleClient(token),
  };
}

/** Check if a verifyAdminRequest result is an error response */
export function isAuthError(result: AdminAuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/** Safe error response that doesn't leak internal details */
export function internalError(logPrefix: string, error: unknown): NextResponse {
  console.error(`[${logPrefix}]`, error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
