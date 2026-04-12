import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/x-msvideo",
  "video/x-matroska",
];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST")
    return errorResponse("Method not allowed", 405, cors);

  const auth = await getAuthenticatedUser(req);
  if ("response" in auth) return auth.response;
  const { user, supabase } = auth;

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return errorResponse("Invalid form data", 400, cors);
    }

    const file = formData.get("file") as File | null;
    const dmChannelId = formData.get("chatId") as string | null;
    if (!file) return errorResponse("File is required", 400, cors);
    if (!dmChannelId) return errorResponse("chatId is required", 400, cors);

    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return errorResponse(
        `Invalid file type: ${mimeType}. Only images and videos allowed.`,
        400,
        cors,
      );
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 10 MB.`,
        413,
        cors,
      );
    }

    let fileType: "image" | "video" | "gif" = "image";
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) fileType = "video";
    else if (mimeType === "image/gif") fileType = "gif";

    // Verify user is a participant in the DM channel
    const { data: channel, error: channelError } = await supabase
      .from("dm_channels")
      .select("id, user1_id, user2_id")
      .eq("id", dmChannelId)
      .single();

    if (channelError || !channel)
      return errorResponse("DM channel not found", 404, cors);

    if (channel.user1_id !== user.id && channel.user2_id !== user.id) {
      return errorResponse("Forbidden", 403, cors);
    }

    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileExt = originalName.split(".").pop()?.toLowerCase() || "bin";
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().replace(/-/g, "").substring(0, 16);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    const filePath = `dm/${dmChannelId}/${user.id}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    let uploadError: Error | null = null;
    let uploadData: { path: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.storage
        .from("chat-media")
        .upload(filePath, fileData, {
          contentType: mimeType,
          upsert: false,
          cacheControl: "3600",
        });
      if (!result.error) {
        uploadData = result.data;
        uploadError = null;
        break;
      }
      uploadError = result.error;
      if (attempt < 2)
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1)),
        );
    }

    if (uploadError) {
      console.error("[DM Media] Upload error:", uploadError.message);
      return jsonResponse({ error: "Failed to upload file" }, 500, cors);
    }

    const { data: urlData } = supabase.storage
      .from("chat-media")
      .getPublicUrl(uploadData?.path || filePath);
    const fileUrl = urlData.publicUrl;
    if (!fileUrl)
      return errorResponse("Failed to generate file URL", 500, cors);

    return jsonResponse(
      {
        url: fileUrl,
        fileUrl,
        fileName: originalName,
        fileType,
        fileSize: file.size,
        mimeType,
      },
      201,
      cors,
    );
  } catch (error) {
    console.error("[DM Media] Error:", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
