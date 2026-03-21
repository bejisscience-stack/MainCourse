import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { enrollmentRequestSchema } from "@/lib/schemas";
import {
  generalLimiter,
  writeLimiter,
  rateLimitResponse,
  getClientIP,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET: Fetch enrollment requests for the current user
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

    const rl = await generalLimiter.check(getClientIP(request));
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const supabase = createServerSupabaseClient(token);

    const { data: requests, error } = await supabase
      .from("enrollment_requests")
      .select(
        `
        id,
        course_id,
        status,
        created_at,
        updated_at,
        courses (
          id,
          title,
          thumbnail_url
        )
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching enrollment requests:", error);
      return NextResponse.json(
        { error: "Failed to fetch enrollment requests" },
        { status: 500 },
      );
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    console.error("Error in GET /api/enrollment-requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST: Create a new enrollment request
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await writeLimiter.check(getClientIP(request));
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const rawBody = await request.json();
    const parsed = enrollmentRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }
    const { courseId, referralCode, isReEnrollment, payment_method } =
      parsed.data;

    const supabase = createServerSupabaseClient(token);

    // Run all validation checks in parallel
    const [requestCheckResult, enrollmentCheckResult, courseCheckResult] =
      await Promise.all([
        supabase
          .from("enrollment_requests")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("course_id", courseId)
          .eq("status", "pending")
          .maybeSingle(),
        supabase
          .from("enrollments")
          .select("id, expires_at")
          .eq("user_id", user.id)
          .eq("course_id", courseId)
          .maybeSingle(),
        supabase.from("courses").select("id").eq("id", courseId).maybeSingle(),
      ]);

    const { data: existingRequest, error: requestCheckError } =
      requestCheckResult;
    const { data: existingEnrollment, error: enrollmentCheckError } =
      enrollmentCheckResult;
    const { data: course, error: courseError } = courseCheckResult;

    if (requestCheckError && requestCheckError.code !== "PGRST116") {
      console.error("Error checking existing request:", requestCheckError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    if (existingRequest) {
      // Reuse existing pending request — allows payment retries.
      // If a referral code is provided now but wasn't on the original request,
      // update the request and process the referral so it isn't silently lost.
      if (referralCode && !isReEnrollment) {
        try {
          // Update referral_code on the existing request if it was null
          await supabase
            .from("enrollment_requests")
            .update({ referral_code: referralCode.trim().toUpperCase() })
            .eq("id", existingRequest.id)
            .is("referral_code", null);

          // Process referral if not already linked
          await supabase.rpc("process_referral", {
            p_referral_code: referralCode.trim().toUpperCase(),
            p_referred_user_id: user.id,
            p_enrollment_request_id: existingRequest.id,
            p_course_id: courseId,
          });
        } catch (refErr) {
          console.error(
            "Error attaching referral to existing request:",
            refErr,
          );
          // Non-blocking — enrollment should still proceed
        }
      }
      return NextResponse.json({ request: existingRequest }, { status: 200 });
    }

    if (enrollmentCheckError && enrollmentCheckError.code !== "PGRST116") {
      console.error(
        "Error checking existing enrollment:",
        enrollmentCheckError,
      );
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    if (existingEnrollment) {
      // Check if this is a re-enrollment request for an expired enrollment
      if (isReEnrollment) {
        const expiresAt = existingEnrollment.expires_at
          ? new Date(existingEnrollment.expires_at)
          : null;
        const isExpired = expiresAt ? expiresAt < new Date() : false;

        if (!isExpired) {
          return NextResponse.json(
            {
              error:
                "Your enrollment is still active. Re-enrollment is only available for expired enrollments.",
            },
            { status: 400 },
          );
        }
        // Allow re-enrollment for expired enrollments - continue to create the request
      } else {
        return NextResponse.json(
          { error: "You are already enrolled in this course" },
          { status: 400 },
        );
      }
    } else if (isReEnrollment) {
      // Re-enrollment requested but no existing enrollment found
      return NextResponse.json(
        { error: "No previous enrollment found for re-enrollment" },
        { status: 400 },
      );
    }

    if (courseError) {
      console.error("Error checking course:", courseError);
      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Create enrollment request
    const { data: enrollmentRequest, error: insertError } = await supabase
      .from("enrollment_requests")
      .insert({
        user_id: user.id,
        course_id: courseId,
        status: "pending",
        payment_screenshots: [],
        referral_code: referralCode ? referralCode.trim().toUpperCase() : null,
        payment_method: payment_method || "keepz",
      })
      .select(
        "id, user_id, course_id, status, payment_screenshots, referral_code, payment_method, created_at, updated_at",
      )
      .single();

    if (insertError) {
      console.error("Error creating enrollment request:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId: user.id,
        courseId: courseId,
      });

      // Check for specific error codes
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "You already have an enrollment request for this course" },
          { status: 400 },
        );
      }

      if (insertError.code === "23503") {
        return NextResponse.json(
          { error: "Invalid course or user" },
          { status: 400 },
        );
      }

      if (insertError.code === "42501") {
        return NextResponse.json(
          {
            error:
              "Permission denied. Please ensure you are logged in correctly.",
          },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: "An error occurred" }, { status: 500 });
    }

    if (!enrollmentRequest) {
      return NextResponse.json(
        { error: "Failed to create enrollment request - no data returned" },
        { status: 500 },
      );
    }

    // Referral commissions only apply to first-time enrollments.
    // Re-enrollments skip referral processing to prevent gaming.
    if (!isReEnrollment && enrollmentRequest.id) {
      try {
        let referralProcessed = false;

        // First, try to process provided referral code (from payment dialog)
        if (referralCode) {
          const { error: referralError, data: referralData } =
            await supabase.rpc("process_referral", {
              p_referral_code: referralCode.trim().toUpperCase(),
              p_referred_user_id: user.id,
              p_enrollment_request_id: enrollmentRequest.id,
              p_course_id: courseId,
            });

          if (!referralError && referralData) {
            referralProcessed = true;
          } else if (referralError) {
            console.error(
              "Error processing provided referral code:",
              referralError,
            );
          }
        }

        // If no referral code was provided or it failed, try signup referral code
        if (!referralProcessed) {
          const { error: signupRefError, data: signupRefData } =
            await supabase.rpc("process_signup_referral_on_enrollment", {
              p_user_id: user.id,
              p_enrollment_request_id: enrollmentRequest.id,
              p_course_id: courseId,
            });

          if (signupRefError) {
            console.error("Error processing signup referral:", signupRefError);
            // Continue - referral is optional, enrollment request should still succeed
          }
        }
      } catch (referralErr: any) {
        console.error("Exception processing referral:", referralErr);
        // Continue - referral is optional
      }
    }

    return NextResponse.json({ request: enrollmentRequest }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/enrollment-requests:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
