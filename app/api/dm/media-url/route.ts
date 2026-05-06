import { NextRequest, NextResponse } from "next/server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  verifyTokenAndGetUser,
  createServiceRoleClient,
  createServerSupabaseClient,
} from "@/lib/supabase-server";
import { isValidUUID } from "@/lib/validation";

const SIGNED_URL_TTL_SECONDS = 900; // 15 min — matches course videos.

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json(
      { error: "Missing path parameter" },
      { status: 400 },
    );
  }

  // dm-media path layout: {conversationId}/{userId}/{filename}
  const normalizedPath = path
    .split("/")
    .filter((s) => s !== "." && s !== "..")
    .join("/");
  const segments = normalizedPath.split("/");
  if (segments.length < 3) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const conversationId = segments[0];
  if (!isValidUUID(conversationId)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const token = getTokenFromHeader(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, error: userError } = await verifyTokenAndGetUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorization: caller must participate in the conversation.
  const supabase = createServerSupabaseClient(token);
  const { data: participation, error: pErr } = await supabase
    .from("dm_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr || !participation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceSupabase = createServiceRoleClient(token);
  const { data, error } = await serviceSupabase.storage
    .from("dm-media")
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[dm/media-url] Signed URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { signedUrl: data.signedUrl },
    {
      headers: {
        "Cache-Control": "private, max-age=720", // 12 min — matches client refresh buffer.
      },
    },
  );
}
