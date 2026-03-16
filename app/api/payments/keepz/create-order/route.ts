import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { createKeepzOrder, getOrderStatus, KeepzError } from "@/lib/keepz";
import { randomUUID } from "crypto";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { paymentLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { paymentOrderSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit
    const { allowed, retryAfterMs } = await paymentLimiter.check(user.id);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // 2. Parse & validate body
    const rawBody = await request.json();
    const parsed = paymentOrderSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }
    const { paymentType, referenceId, saveCard, savedCardId } = parsed.data;

    const supabase = createServerSupabaseClient(token);
    const adminSupabase = createServiceRoleClient();

    // 3. Validate reference and get amount
    let amount: number;
    if (paymentType === "course_enrollment") {
      const { data: enrollment, error } = await supabase
        .from("enrollment_requests")
        .select("id, status, user_id, courses(price)")
        .eq("id", referenceId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .single();
      if (error || !enrollment) {
        return NextResponse.json(
          { error: "Enrollment request not found or not pending" },
          { status: 404 },
        );
      }
      // courses is joined as object
      const course = enrollment.courses as any;
      amount = course?.price || 0;
      if (amount <= 0) {
        return NextResponse.json(
          { error: "Invalid course price" },
          { status: 400 },
        );
      }
    } else if (paymentType === "bundle_enrollment") {
      const { data: bundleReq, error } = await supabase
        .from("bundle_enrollment_requests")
        .select("id, status, user_id, course_bundles(price)")
        .eq("id", referenceId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .single();
      if (error || !bundleReq) {
        return NextResponse.json(
          { error: "Bundle enrollment request not found or not pending" },
          { status: 404 },
        );
      }
      const bundle = bundleReq.course_bundles as any;
      amount = bundle?.price || 0;
      if (amount <= 0) {
        return NextResponse.json(
          { error: "Invalid bundle price" },
          { status: 400 },
        );
      }
    } else if (paymentType === "project_subscription") {
      // project_subscription — price stored per subscription record
      const { data: sub, error } = await supabase
        .from("project_subscriptions")
        .select("id, status, user_id, price")
        .eq("id", referenceId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .single();
      if (error || !sub) {
        return NextResponse.json(
          { error: "Subscription not found or not pending" },
          { status: 404 },
        );
      }
      amount = (sub as any).price || 0.1;
      if (amount <= 0) {
        return NextResponse.json(
          { error: "Invalid subscription price" },
          { status: 400 },
        );
      }
    } else {
      // project_budget — lecturer pays the project budget amount
      const { data: project, error } = await supabase
        .from("projects")
        .select("id, status, user_id, budget")
        .eq("id", referenceId)
        .eq("user_id", user.id)
        .eq("status", "pending_payment")
        .single();
      if (error || !project) {
        return NextResponse.json(
          { error: "Project not found or not pending payment" },
          { status: 404 },
        );
      }
      amount = Number((project as any).budget) || 0;
      if (amount <= 0) {
        return NextResponse.json(
          { error: "Invalid project budget" },
          { status: 400 },
        );
      }
    }

    // 4. Idempotency check — existing active payment for this reference
    const { data: existing } = await supabase
      .from("keepz_payments")
      .select("id, checkout_url, status, created_at, keepz_order_id")
      .eq("payment_type", paymentType)
      .eq("reference_id", referenceId)
      .in("status", ["pending", "created"])
      .maybeSingle();

    if (existing) {
      // Keepz orders expire after 5 minutes — but first verify if user actually paid
      const ageMs = Date.now() - new Date(existing.created_at).getTime();
      const FIVE_MINUTES = 5 * 60 * 1000;

      if (ageMs < FIVE_MINUTES && existing.checkout_url) {
        return NextResponse.json({
          checkoutUrl: existing.checkout_url,
          paymentId: existing.id,
        });
      }

      // Before expiring, verify with Keepz — the user may have paid but callback never arrived
      if (existing.status === "created" && existing.keepz_order_id) {
        try {
          const keepzStatus = await getOrderStatus(existing.keepz_order_id);
          const orderStatus =
            (keepzStatus.orderStatus as string) ||
            (keepzStatus.status as string);

          if (orderStatus === "SUCCESS") {
            // Payment was actually successful — complete enrollment now
            const { data: rpcResult, error: rpcError } =
              await adminSupabase.rpc("complete_keepz_payment", {
                p_keepz_order_id: existing.keepz_order_id,
                p_callback_payload: keepzStatus,
              });

            if (!rpcError && rpcResult?.success !== false) {
              console.log(
                "[Create Order] Recovered lost payment via Keepz verification:",
                { paymentId: existing.id },
              );
              return NextResponse.json({
                paymentId: existing.id,
                recovered: true,
                status: "success",
              });
            }
            console.error(
              "[Create Order] Keepz verified SUCCESS but RPC failed:",
              { rpcError, rpcResult },
            );
          } else if (
            orderStatus === "FAILED" ||
            orderStatus === "REJECTED" ||
            orderStatus === "CANCELLED"
          ) {
            await adminSupabase
              .from("keepz_payments")
              .update({
                status: "failed",
                callback_payload: keepzStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          }
        } catch (verifyErr) {
          console.warn(
            "[Create Order] Keepz verification failed (non-fatal):",
            verifyErr,
          );
          // Audit log so we know why self-healing failed
          adminSupabase
            .from("payment_audit_log")
            .insert({
              keepz_payment_id: existing.id,
              keepz_order_id: existing.keepz_order_id,
              user_id: user.id,
              event_type: "create_order_verify_failed",
              event_data: {
                error: String(verifyErr),
                stack: verifyErr instanceof Error ? verifyErr.stack : undefined,
              },
            })
            .then(
              () => {},
              () => {},
            );
        }
      }

      // Expire the stale payment if it wasn't recovered above
      if (existing.status !== "success") {
        await adminSupabase
          .from("keepz_payments")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .in("status", ["pending", "created"]);
      }
    }

    // 5. Create keepz_payments row (status: pending) with keepz_order_id pre-set
    //    so the callback can find this payment even if the server crashes after Keepz call
    const integratorOrderId = randomUUID();
    const { data: paymentRow, error: insertError } = await supabase
      .from("keepz_payments")
      .insert({
        user_id: user.id,
        payment_type: paymentType,
        reference_id: referenceId,
        amount,
        currency: "GEL",
        status: "pending",
        keepz_order_id: integratorOrderId,
        price_at_order_time: amount,
      })
      .select("id")
      .single();

    if (insertError || !paymentRow) {
      console.error("Failed to create payment row:", insertError);
      return NextResponse.json(
        { error: "Failed to create payment" },
        { status: 500 },
      );
    }

    // 6. Create Keepz order with optional payment method pre-selection
    // NEXT_PUBLIC_APP_URL is reliable per-environment; request.nextUrl.origin
    // returns localhost:8080 behind DigitalOcean's reverse proxy.
    const forwardedHost =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ||
      "https://swavleba.ge";
    const orderOptions: Parameters<typeof createKeepzOrder>[0] = {
      amount,
      currency: "GEL",
      integratorOrderId,
      successRedirectUri: `${appUrl}/payment/success?paymentId=${paymentRow.id}`,
      failRedirectUri: `${appUrl}/payment/failed?paymentId=${paymentRow.id}`,
      callbackUri: `${appUrl}/api/payments/keepz/callback`,
    };

    console.log("[Create Order] Callback URL configured:", {
      callbackUri: orderOptions.callbackUri,
      successRedirect: orderOptions.successRedirectUri,
      appUrl,
    });

    // Saved card: look up card_token if savedCardId is provided
    if (savedCardId) {
      const { data: savedCard, error: cardErr } = await supabase
        .from("saved_cards")
        .select("card_token")
        .eq("id", savedCardId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (cardErr || !savedCard) {
        return NextResponse.json(
          { error: "Saved card not found" },
          { status: 404 },
        );
      }

      orderOptions.cardToken = savedCard.card_token;
    }

    // Save card for future use (first-time redirect payment)
    if (saveCard && !savedCardId) {
      orderOptions.saveCard = true;
    }

    let checkoutUrl: string | null;
    let saveCardUnsupported = false;
    try {
      const result = await createKeepzOrder(orderOptions);
      checkoutUrl = result.checkoutUrl;
    } catch (keepzErr) {
      // Handle saveCard permission error — retry without saveCard
      if (
        keepzErr instanceof KeepzError &&
        keepzErr.statusCode === 6031 &&
        orderOptions.saveCard
      ) {
        console.warn("[Keepz] saveCard not permitted, retrying without it");
        delete orderOptions.saveCard;
        delete orderOptions.directLinkProvider;
        saveCardUnsupported = true;
        try {
          const result = await createKeepzOrder(orderOptions);
          checkoutUrl = result.checkoutUrl;
        } catch (retryErr) {
          await adminSupabase
            .from("keepz_payments")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", paymentRow.id);
          throw retryErr;
        }
      } else {
        // Clean up the pending payment row so it doesn't block retries
        await adminSupabase
          .from("keepz_payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", paymentRow.id);
        throw keepzErr;
      }
    }

    // Track if saveCard was requested
    const updateData: Record<string, unknown> = {
      status: "created",
      updated_at: new Date().toISOString(),
    };
    if (checkoutUrl) updateData.checkout_url = checkoutUrl;
    if (saveCard && !saveCardUnsupported) updateData.save_card = true;

    await adminSupabase
      .from("keepz_payments")
      .update(updateData)
      .eq("id", paymentRow.id);

    // Token-based charge (saved card): no redirect, payment processes server-side
    if (!checkoutUrl) {
      return NextResponse.json({
        paymentId: paymentRow.id,
        processing: true,
        saveCardUnsupported,
      });
    }

    return NextResponse.json({
      checkoutUrl,
      paymentId: paymentRow.id,
      saveCardUnsupported,
    });
  } catch (error) {
    if (error instanceof KeepzError) {
      console.error(
        "Keepz API error:",
        error.message,
        "statusCode:",
        error.statusCode,
        "exceptionGroup:",
        error.exceptionGroup,
      );
      return NextResponse.json({ error: "An error occurred" }, { status: 502 });
    }
    console.error("Create order error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
