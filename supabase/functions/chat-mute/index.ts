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

  if (
    req.method !== "POST" &&
    req.method !== "GET" &&
    req.method !== "DELETE"
  ) {
    return errorResponse("Method not allowed", 405, cors);
  }

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  const url = new URL(req.url);

  // GET - Check if user is muted
  if (req.method === "GET") {
    const chatId = url.searchParams.get("chatId");
    const userId = url.searchParams.get("userId");

    if (!chatId) return errorResponse("chatId is required", 400, cors);
    if (!userId) return errorResponse("userId is required", 400, cors);

    try {
      const { data: channel, error: channelError } = await supabase
        .from("channels")
        .select("id, course_id")
        .eq("id", chatId)
        .single();
      if (channelError || !channel)
        return errorResponse("Channel not found", 404, cors);

      const { data: course } = await supabase
        .from("courses")
        .select("lecturer_id")
        .eq("id", channel.course_id)
        .single();

      if (!course?.lecturer_id)
        return jsonResponse({ muted: false }, 200, cors);

      const { data: mutedRecord } = await supabase
        .from("muted_users")
        .select("id")
        .eq("lecturer_id", course.lecturer_id)
        .eq("user_id", userId)
        .single();

      return jsonResponse({ muted: !!mutedRecord }, 200, cors);
    } catch (error) {
      console.error("Error:", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // DELETE - Unmute user
  if (req.method === "DELETE") {
    const chatId = url.searchParams.get("chatId");
    const userId = url.searchParams.get("userId");

    if (!chatId) return errorResponse("chatId is required", 400, cors);
    if (!userId) return errorResponse("userId is required", 400, cors);

    try {
      const { data: channel, error: channelError } = await supabase
        .from("channels")
        .select("id, course_id")
        .eq("id", chatId)
        .single();
      if (channelError || !channel)
        return errorResponse("Channel not found", 404, cors);

      const { data: course } = await supabase
        .from("courses")
        .select("lecturer_id")
        .eq("id", channel.course_id)
        .single();
      if (!course) return errorResponse("Course not found", 404, cors);
      if (course.lecturer_id !== user.id)
        return errorResponse(
          "Forbidden: Only lecturers can unmute users",
          403,
          cors,
        );

      const { error: unmuteError } = await supabase
        .from("muted_users")
        .delete()
        .eq("lecturer_id", user.id)
        .eq("user_id", userId);

      if (unmuteError)
        return jsonResponse(
          { error: "Failed to unmute user", details: unmuteError.message },
          500,
          cors,
        );

      return jsonResponse(
        { muted: false, message: "User has been unmuted" },
        200,
        cors,
      );
    } catch (error) {
      console.error("Error:", error);
      return errorResponse("Internal server error", 500, cors);
    }
  }

  // POST - Mute/unmute user
  try {
    const body = await req.json();
    const { chatId, muted, userId } = body;

    if (!chatId) return errorResponse("chatId is required", 400, cors);
    if (typeof muted !== "boolean")
      return errorResponse("muted (boolean) is required", 400, cors);

    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, course_id")
      .eq("id", chatId)
      .single();
    if (channelError || !channel)
      return errorResponse("Channel not found", 404, cors);

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("lecturer_id")
      .eq("id", channel.course_id)
      .single();
    if (courseError || !course)
      return errorResponse("Course not found", 404, cors);

    if (course.lecturer_id !== user.id)
      return errorResponse(
        "Forbidden: Only lecturers can mute users",
        403,
        cors,
      );
    if (!userId)
      return errorResponse(
        "userId is required to mute/unmute a user",
        400,
        cors,
      );
    if (userId === user.id)
      return errorResponse("Cannot mute yourself", 400, cors);

    if (muted) {
      const { data: mutedUser, error: muteError } = await supabase
        .from("muted_users")
        .insert({
          lecturer_id: user.id,
          user_id: userId,
          muted_by: user.id,
          channel_id: chatId,
          course_id: channel.course_id,
        })
        .select(
          "id, lecturer_id, user_id, muted_by, channel_id, course_id, created_at",
        )
        .single();

      if (muteError) {
        if (muteError.code === "23505")
          return jsonResponse({ error: "User is already muted" }, 409, cors);
        return jsonResponse(
          { error: "Failed to mute user", details: muteError.message },
          500,
          cors,
        );
      }
      return jsonResponse(
        { muted: true, mutedUser, message: "User has been muted" },
        201,
        cors,
      );
    } else {
      const { error: unmuteError } = await supabase
        .from("muted_users")
        .delete()
        .eq("lecturer_id", user.id)
        .eq("user_id", userId);
      if (unmuteError)
        return jsonResponse(
          { error: "Failed to unmute user", details: unmuteError.message },
          500,
          cors,
        );
      return jsonResponse(
        { muted: false, message: "User has been unmuted" },
        200,
        cors,
      );
    }
  } catch (error) {
    return errorResponse("Internal server error", 500, cors);
  }
});
