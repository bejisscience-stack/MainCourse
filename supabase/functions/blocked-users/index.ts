import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  try {
    // GET — List blocked users
    if (req.method === "GET") {
      const { data: blocked, error: blockedError } = await supabase
        .from("blocked_users")
        .select("blocked_id, created_at")
        .eq("blocker_id", user.id);

      if (blockedError) {
        console.error("[blocked-users] GET error:", blockedError.message);
        return errorResponse("Failed to fetch blocked users", 500, cors);
      }

      if (!blocked || blocked.length === 0) {
        return jsonResponse({ blockedUsers: [] }, 200, cors);
      }

      const blockedIds = blocked.map((b) => b.blocked_id);

      const { data: profiles, error: profilesError } = await supabase.rpc(
        "get_safe_profiles",
        { user_ids: blockedIds },
      );

      if (profilesError) {
        console.error("[blocked-users] profiles error:", profilesError.message);
        return errorResponse("Failed to fetch blocked user profiles", 500, cors);
      }

      // Build a map of blocked_id → created_at for blockedAt
      const blockedAtMap = new Map(
        blocked.map((b) => [b.blocked_id, b.created_at]),
      );

      const blockedUsers = (profiles || []).map((p: Record<string, unknown>) => ({
        id: p.id,
        username: p.username,
        avatarUrl: p.avatar_url,
        blockedAt: blockedAtMap.get(p.id as string) ?? null,
      }));

      return jsonResponse({ blockedUsers }, 200, cors);
    }

    // POST — Block a user
    if (req.method === "POST") {
      const body = await req.json();
      const { userId } = body;

      if (!userId || typeof userId !== "string") {
        return errorResponse("userId is required", 400, cors);
      }

      if (userId === user.id) {
        return errorResponse("Cannot block yourself", 400, cors);
      }

      const { error: blockError } = await supabase.rpc("block_user_action", {
        blocker: user.id,
        target: userId,
      });

      if (blockError) {
        console.error("[blocked-users] POST error:", blockError.message);
        return errorResponse("Failed to block user", 500, cors);
      }

      return jsonResponse({ success: true }, 200, cors);
    }

    // DELETE — Unblock a user
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const userId = url.searchParams.get("userId");

      if (!userId) {
        return errorResponse("userId query parameter is required", 400, cors);
      }

      const { error: unblockError } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", userId);

      if (unblockError) {
        console.error("[blocked-users] DELETE error:", unblockError.message);
        return errorResponse("Failed to unblock user", 500, cors);
      }

      return jsonResponse({ success: true }, 200, cors);
    }

    return errorResponse("Method not allowed", 405, cors);
  } catch (err) {
    console.error("[blocked-users] Unexpected error:", err);
    return errorResponse("Internal server error", 500, cors);
  }
});
