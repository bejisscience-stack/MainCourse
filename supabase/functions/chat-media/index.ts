import {
  getCorsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import { getAuthenticatedUser, checkIsAdmin } from "../_shared/auth.ts";
import { detectMime } from "../_shared/sniff.ts";

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
    const chatId = formData.get("chatId") as string | null;
    if (!file) return errorResponse("File is required", 400, cors);
    if (!chatId) return errorResponse("chatId is required", 400, cors);

    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return errorResponse(
        `Invalid file type: ${mimeType}. Only images and videos allowed.`,
        400,
        cors,
      );
    }

    let fileType: "image" | "video" | "gif" = "image";
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) fileType = "video";
    else if (mimeType === "image/gif") fileType = "gif";

    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .select("id, course_id")
      .eq("id", chatId)
      .single();
    if (channelError || !channel)
      return errorResponse("Channel not found", 404, cors);

    const isAdmin = await checkIsAdmin(supabase, user.id);
    const { data: course } = await supabase
      .from("courses")
      .select("lecturer_id")
      .eq("id", channel.course_id)
      .single();

    if (!isAdmin) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", channel.course_id)
        .single();
      if (!enrollment && course?.lecturer_id !== user.id)
        return errorResponse("Forbidden", 403, cors);

      const { data: mutedUser } = await supabase
        .from("muted_users")
        .select("id")
        .eq("lecturer_id", course?.lecturer_id)
        .eq("user_id", user.id)
        .single();
      if (mutedUser)
        return errorResponse(
          "You have been muted and cannot upload files",
          403,
          cors,
        );
    }

    // Per-role size cap: admins and the course's lecturer get 100 MB,
    // students stay at 10 MB. Bucket-level cap is 100 MB.
    const isPrivileged = isAdmin || course?.lecturer_id === user.id;
    const MAX_FILE_SIZE = isPrivileged ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    const maxMb = isPrivileged ? 100 : 10;
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${maxMb} MB.`,
        413,
        cors,
      );
    }

    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileExt = originalName.split(".").pop()?.toLowerCase() || "bin";
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().replace(/-/g, "").substring(0, 16);
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    const filePath = `${channel.course_id}/${chatId}/${user.id}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const sniffedMime = detectMime(fileData.subarray(0, 32));
    if (!sniffedMime || !ALLOWED_TYPES.includes(sniffedMime)) {
      return errorResponse(
        "File content does not match an allowed type",
        400,
        cors,
      );
    }
    const safeMimeType = sniffedMime;

    let uploadError: Error | null = null;
    let uploadData: { path: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.storage
        .from("chat-media")
        .upload(filePath, fileData, {
          contentType: safeMimeType,
          upsert: false,
          cacheControl: "3600",
        });
      if (!result.error) {
        uploadData = result.data;
        uploadError = null;
        break;
      }
      uploadError = result.error;
      if (
        result.error.message?.includes("duplicate") ||
        result.error.message?.includes("already exists")
      ) {
        const retryPath = `${channel.course_id}/${chatId}/${user.id}/${timestamp}-${randomId}-${attempt + 1}.${fileExt}`;
        const retryResult = await supabase.storage
          .from("chat-media")
          .upload(retryPath, fileData, {
            contentType: safeMimeType,
            upsert: true,
            cacheControl: "3600",
          });
        if (!retryResult.error) {
          uploadData = retryResult.data;
          uploadError = null;
          break;
        }
      }
      if (attempt < 2)
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1)),
        );
    }

    if (uploadError) {
      console.error("File upload error:", uploadError.message);
      return jsonResponse({ error: "Failed to upload file" }, 500, cors);
    }

    // chat-media is private (mig 235); return the bucket-relative path. The
    // client persists this path; reads are signed on demand.
    const storedPath = uploadData?.path || filePath;

    return jsonResponse(
      {
        path: storedPath,
        fileName: originalName,
        fileType,
        fileSize: file.size,
        mimeType: safeMimeType,
      },
      201,
      cors,
    );
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500, cors);
  }
});
