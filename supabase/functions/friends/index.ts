import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

interface SafeProfile {
  id: string;
  username: string;
  avatarUrl: string;
  role?: string;
}

function toSafeProfile(p: {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
}): SafeProfile {
  return {
    id: p.id,
    username: p.username || "User",
    avatarUrl: p.avatar_url || "",
    ...(p.role ? { role: p.role } : {}),
  };
}

// deno-lint-ignore no-explicit-any
async function loadSafeProfiles(
  supabase: any,
  userIds: string[],
): Promise<Map<string, SafeProfile>> {
  const map = new Map<string, SafeProfile>();
  if (userIds.length === 0) return map;
  const unique = [...new Set(userIds)];
  const { data, error } = await supabase.rpc("get_safe_profiles", {
    user_ids: unique,
  });
  if (error || !data) return map;
  for (const row of data) {
    map.set(row.id, toSafeProfile(row));
  }
  return map;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET" && req.method !== "POST")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  if (req.method === "GET") {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "friends";

    try {
      if (view === "search") {
        const q = (url.searchParams.get("q") || "").trim();
        if (q.length < 2) return jsonResponse({ candidates: [] }, 200, cors);

        const { data, error } = await supabase.rpc("search_friend_candidates", {
          p_query: q,
          p_limit: 20,
        });
        if (error) {
          console.error("[friends] search rpc error", error);
          return errorResponse("Search failed", 500, cors);
        }
        const candidates = (data || []).map(
          (r: {
            id: string;
            username: string | null;
            avatar_url: string | null;
            role: string | null;
            status: string;
          }) => ({
            ...toSafeProfile(r),
            status: r.status,
          }),
        );
        return jsonResponse({ candidates }, 200, cors);
      }

      if (view === "friends") {
        const { data: rows, error } = await supabase
          .from("friendships")
          .select("id, user_low_id, user_high_id, created_at")
          .or(`user_low_id.eq.${user.id},user_high_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (error) return errorResponse("Failed to load friends", 500, cors);
        const list = rows || [];
        const otherIds = list.map((r) =>
          r.user_low_id === user.id ? r.user_high_id : r.user_low_id,
        );
        const profiles = await loadSafeProfiles(supabase, otherIds);

        const friends = list
          .map((r) => {
            const otherId =
              r.user_low_id === user.id ? r.user_high_id : r.user_low_id;
            const profile = profiles.get(otherId);
            if (!profile) return null;
            return {
              friendshipId: r.id,
              user: profile,
              since: new Date(r.created_at).getTime(),
            };
          })
          .filter(Boolean);

        return jsonResponse({ friends }, 200, cors);
      }

      if (view === "incoming" || view === "outgoing") {
        const isIncoming = view === "incoming";
        const column = isIncoming ? "addressee_id" : "requester_id";
        const otherColumn = isIncoming ? "requester_id" : "addressee_id";

        const { data: rows, error } = await supabase
          .from("friend_requests")
          .select(
            "id, requester_id, addressee_id, status, created_at, updated_at",
          )
          .eq(column, user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (error) return errorResponse("Failed to load requests", 500, cors);
        const list = rows || [];
        const otherIds = list.map(
          (r) => r[otherColumn as keyof typeof r] as string,
        );
        const profiles = await loadSafeProfiles(supabase, otherIds);

        const requests = list
          .map((r) => {
            const otherId = r[otherColumn as keyof typeof r] as string;
            const profile = profiles.get(otherId);
            if (!profile) return null;
            return {
              id: r.id,
              status: r.status,
              createdAt: new Date(r.created_at).getTime(),
              user: profile,
            };
          })
          .filter(Boolean);

        return jsonResponse({ requests }, 200, cors);
      }

      return errorResponse("Unknown view", 400, cors);
    } catch (error) {
      console.error("[friends] GET error", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // POST
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "send_request") {
      const userId = body?.userId;
      if (typeof userId !== "string" || userId.length === 0)
        return errorResponse("userId is required", 400, cors);
      if (userId === user.id)
        return errorResponse("Cannot send a request to yourself", 400, cors);

      // Pre-check existing accepted friendship.
      const lo = userId < user.id ? userId : user.id;
      const hi = userId < user.id ? user.id : userId;
      const { data: existingFriendship } = await supabase
        .from("friendships")
        .select("id")
        .eq("user_low_id", lo)
        .eq("user_high_id", hi)
        .maybeSingle();
      if (existingFriendship)
        return errorResponse("Already friends", 409, cors);

      const { data, error } = await supabase
        .from("friend_requests")
        .insert({
          requester_id: user.id,
          addressee_id: userId,
          status: "pending",
        })
        .select("id, status, created_at")
        .single();

      if (error) {
        if (
          error.code === "23505" /* unique violation */ ||
          error.message?.toLowerCase().includes("duplicate")
        ) {
          return errorResponse("Pending request already exists", 409, cors);
        }
        console.error("[friends] send_request insert error", error);
        return errorResponse("Failed to send request", 500, cors);
      }

      return jsonResponse({ request: data }, 201, cors);
    }

    if (action === "cancel_request") {
      const requestId = body?.requestId;
      if (typeof requestId !== "string")
        return errorResponse("requestId is required", 400, cors);

      const { data, error } = await supabase
        .from("friend_requests")
        .update({ status: "canceled" })
        .eq("id", requestId)
        .eq("requester_id", user.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (error) return errorResponse("Failed to cancel request", 500, cors);
      if (!data) return errorResponse("Request not found", 404, cors);
      return jsonResponse({ ok: true }, 200, cors);
    }

    if (action === "accept_request") {
      const requestId = body?.requestId;
      if (typeof requestId !== "string")
        return errorResponse("requestId is required", 400, cors);

      const { data, error } = await supabase.rpc("accept_friend_request", {
        p_request_id: requestId,
      });
      if (error) {
        console.error("[friends] accept rpc error", error);
        return errorResponse(error.message || "Failed to accept", 400, cors);
      }
      return jsonResponse({ friendshipId: data }, 200, cors);
    }

    if (action === "decline_request") {
      const requestId = body?.requestId;
      if (typeof requestId !== "string")
        return errorResponse("requestId is required", 400, cors);

      const { data, error } = await supabase
        .from("friend_requests")
        .update({ status: "declined" })
        .eq("id", requestId)
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (error) return errorResponse("Failed to decline request", 500, cors);
      if (!data) return errorResponse("Request not found", 404, cors);
      return jsonResponse({ ok: true }, 200, cors);
    }

    if (action === "remove_friend") {
      const userId = body?.userId;
      if (typeof userId !== "string")
        return errorResponse("userId is required", 400, cors);
      if (userId === user.id) return errorResponse("Invalid userId", 400, cors);

      const lo = userId < user.id ? userId : user.id;
      const hi = userId < user.id ? user.id : userId;

      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_low_id", lo)
        .eq("user_high_id", hi);

      if (error) return errorResponse("Failed to remove friend", 500, cors);
      return jsonResponse({ ok: true }, 200, cors);
    }

    return errorResponse("Unknown action", 400, cors);
  } catch (error) {
    console.error("[friends] POST error", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
