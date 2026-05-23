import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isSafeUrl } from "@/lib/url-utils";

export const dynamic = "force-dynamic";

type CriterionInput = {
  text?: string;
  rpm?: number;
  platform?: string | null;
};

type ResourceInput = {
  type?: "image" | "video" | "link";
  title?: string | null;
  url?: string;
};

type CreateProjectBody = {
  name?: string;
  description?: string;
  thumbnailUrl?: string | null;
  videoLink?: string | null;
  budget?: number;
  minViews?: number;
  maxViews?: number;
  platforms?: string[];
  startDate?: string;
  endDate?: string;
  criteria?: CriterionInput[];
  resources?: ResourceInput[];
};

// POST /api/lecturer/projects
// Creates a STANDALONE project (no course/channel/message) on behalf of an
// approved lecturer. For paid projects (budget > 0) it returns a Keepz
// checkoutUrl that the client must redirect to; for free projects (budget = 0
// or exempt lecturer) the project is created with status='active' by the
// trg_set_project_pending_payment trigger (mig 205).
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

    const supabase = createServerSupabaseClient(token);

    // Confirm caller is an approved lecturer. RLS would block the insert
    // anyway, but we want a clean 403 rather than an opaque PostgREST error.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, lecturer_status, can_create_free_projects")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 },
      );
    }
    if (
      !profile ||
      profile.role !== "lecturer" ||
      profile.lecturer_status !== "approved"
    ) {
      return NextResponse.json(
        { error: "Only approved lecturers can create projects" },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as CreateProjectBody;

    const {
      name,
      description,
      thumbnailUrl,
      videoLink,
      budget,
      minViews,
      maxViews,
      platforms,
      startDate,
      endDate,
      criteria,
      resources,
    } = body;

    // Input validation. The DB CHECK constraints (mig 050) also enforce most
    // of these, but a clean 400 is friendlier than a Postgres error string.
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }
    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Project description is required" },
        { status: 400 },
      );
    }
    if (typeof budget !== "number" || budget < 0 || !Number.isFinite(budget)) {
      return NextResponse.json(
        { error: "Budget must be a non-negative number" },
        { status: 400 },
      );
    }
    if (
      typeof minViews !== "number" ||
      minViews < 0 ||
      !Number.isInteger(minViews)
    ) {
      return NextResponse.json(
        { error: "minViews must be a non-negative integer" },
        { status: 400 },
      );
    }
    if (typeof maxViews !== "number" || maxViews <= minViews) {
      return NextResponse.json(
        { error: "maxViews must be greater than minViews" },
        { status: 400 },
      );
    }
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "At least one platform is required" },
        { status: 400 },
      );
    }
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    const isExempt = profile.can_create_free_projects === true;
    const needsPayment = budget > 0 && !isExempt;

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      course_id: null,
      channel_id: null,
      message_id: null,
      name: name.trim(),
      description: description.trim(),
      thumbnail_url: thumbnailUrl ?? null,
      video_link: videoLink ?? null,
      budget,
      min_views: minViews,
      max_views: maxViews,
      platforms,
      start_date: startDate,
      end_date: endDate,
    };
    // Client hint only; mig 205 trigger is the authoritative gate.
    if (needsPayment) insertPayload.status = "pending_payment";

    const { data: projectRecord, error: projectError } = await supabase
      .from("projects")
      .insert(insertPayload)
      .select("id")
      .single();

    if (projectError || !projectRecord) {
      console.error("[lecturer/projects] insert error:", projectError?.message);
      return NextResponse.json(
        { error: projectError?.message || "Failed to create project" },
        { status: 500 },
      );
    }

    // Criteria are independent rows; a partial failure here should not orphan
    // the project. Log and continue — matches ChatArea.tsx behaviour.
    if (Array.isArray(criteria) && criteria.length > 0) {
      const rows = criteria
        .filter((c) => c && typeof c.text === "string" && c.text.trim() !== "")
        .map((c, i) => ({
          project_id: projectRecord.id,
          criteria_text: c.text!.trim(),
          rpm: typeof c.rpm === "number" ? c.rpm : 0,
          display_order: i,
          platform: c.platform ?? null,
        }));
      if (rows.length > 0) {
        const { error: critError } = await supabase
          .from("project_criteria")
          .insert(rows);
        if (critError) {
          console.error(
            "[lecturer/projects] criteria insert error:",
            critError.message,
          );
        }
      }
    }

    if (Array.isArray(resources) && resources.length > 0) {
      // SEC: scheme/path validation per resource type.
      //   - link  → must be a real http(s) URL (rejects javascript:/data:/etc.).
      //   - image/video → must be a relative storage path under
      //     standalone-projects/{user.id}/ to prevent path laundering through
      //     /api/project-media/sign (chat-media bucket isolation).
      const ownerPrefix = `standalone-projects/${user.id}/`;
      const rows = resources
        .filter(
          (
            r,
          ): r is ResourceInput & {
            url: string;
            type: NonNullable<ResourceInput["type"]>;
          } =>
            !!r &&
            typeof r.url === "string" &&
            r.url.trim() !== "" &&
            (r.type === "image" || r.type === "video" || r.type === "link"),
        )
        .map((r) => ({ ...r, url: r.url.trim() }))
        .filter((r) => {
          if (r.type === "link") return isSafeUrl(r.url);
          // image/video: relative storage path, owner-scoped
          if (r.url.includes("://")) return false;
          return r.url.startsWith(ownerPrefix);
        })
        .map((r, i) => ({
          project_id: projectRecord.id,
          resource_type: r.type,
          title: r.title?.trim() || null,
          url: r.url,
          display_order: i,
        }));
      if (rows.length > 0) {
        const { error: resourceError } = await supabase
          .from("project_resources")
          .insert(rows);
        if (resourceError) {
          console.error(
            "[lecturer/projects] resources insert error:",
            resourceError.message,
          );
        }
      }
    }

    // Paid project → kick off Keepz order. The client receives a checkoutUrl
    // to redirect to (mirrors ChatArea.tsx:866-903).
    if (needsPayment) {
      const origin = request.nextUrl.origin;
      const orderResp = await fetch(
        `${origin}/api/payments/keepz/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentType: "project_budget",
            referenceId: projectRecord.id,
          }),
        },
      );

      const orderData = await orderResp.json().catch(() => ({}));
      if (!orderResp.ok) {
        return NextResponse.json(
          {
            projectId: projectRecord.id,
            error: orderData?.error || "Failed to create payment order",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        projectId: projectRecord.id,
        needsPayment: true,
        ...orderData,
      });
    }

    return NextResponse.json({
      projectId: projectRecord.id,
      needsPayment: false,
    });
  } catch (error: any) {
    console.error("[lecturer/projects] unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
