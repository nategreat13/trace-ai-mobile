import { Router } from "express";
import * as admin from "firebase-admin";
import { colRef } from "../firebase";
import { getEnv } from "../env";
import { fanOutConversion } from "../lib/ad-conversions";
import { listActiveEntitlements } from "../lib/revenuecat-rest";
import { sendToUser } from "../lib/push";
import { getTemplate, renderString, TEMPLATE_CATEGORY } from "../lib/notification-templates";

export const revenuecatWebhookRoutes = Router();

type Tier = "premium" | "business";

/**
 * Mirror of the client-side `logEvent` helper. Writes to the same `events`
 * collection so the analytics dashboard can query lifecycle events
 * (renewals, cancellations, expirations, billing issues) alongside the
 * client-side funnel events. Fire-and-forget — never throw.
 */
async function logAnalyticsEvent(
  name: string,
  userId: string,
  props: Record<string, unknown>
): Promise<void> {
  // Strip undefined so Firestore doesn't reject the doc
  const cleanProps: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) cleanProps[k] = v;
  }
  try {
    await colRef("events").add({
      name,
      userId,
      props: cleanProps,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: "revenuecat_webhook",
    });
  } catch (err) {
    console.warn("[RC Webhook] Failed to log analytics event:", name, err);
  }
}

/**
 * Derive the user's effective tier from an RC event's `entitlement_ids` array.
 * Business wins over Premium if both are present.
 * Returns null if no known entitlements are active.
 */
function tierFromEntitlements(entitlementIds: unknown): Tier | null {
  if (!Array.isArray(entitlementIds)) return null;
  if (entitlementIds.includes("business")) return "business";
  if (entitlementIds.includes("premium")) return "premium";
  return null;
}

/**
 * Fallback: derive tier from a product ID string using naming convention.
 * Used only when `entitlement_ids` is missing.
 */
function tierFromProductId(productId: unknown): Tier | null {
  if (typeof productId !== "string") return null;
  if (productId.includes("business")) return "business";
  if (productId.includes("premium")) return "premium";
  return null;
}

/**
 * Money-bearing event types — only these get an "Amount" field in the
 * Slack post. CANCELLATION / EXPIRATION / BILLING_ISSUE may carry a
 * stale price in the payload, but showing a dollar figure there reads
 * as if money moved, so we suppress it.
 */
const MONEY_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
]);

/**
 * Post a rich revenue notification to Slack. This is OUR custom post —
 * it runs ALONGSIDE RevenueCat's native Slack integration (both can be
 * enabled at once). The native one only knows the truncated app_user_id;
 * this one joins against the userProfile so it can show real name +
 * email plus tier / promo / pricing / store detail.
 *
 * MUST be awaited by the caller. An un-awaited fetch gets frozen when
 * Cloud Run throttles CPU after the HTTP response is sent — the exact
 * silent-failure mode that broke the Meta CAPI fan-out. Swallows all
 * errors internally so it can never break webhook processing.
 */
async function sendRevenueSlack(args: {
  type: string;
  displayName: string;
  email: string | null;
  appUserId: string;
  tier: Tier | null;
  productId: string | null;
  newProductId: string | null;
  priceUsd: number | null;
  priceLocal: number | null;
  currency: string | null;
  periodType: string | null;
  store: string | null;
  countryCode: string | null;
  environment: string | null;
  expirationAtMs: number | null;
  isFirstPurchase: boolean;
  lifetimeRevenueCents: number;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_REVENUE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      "[RC Webhook] SLACK_REVENUE_WEBHOOK_URL not set; skipping revenue Slack post"
    );
    return;
  }

  const isStaging = getEnv() === "staging";
  const isTrial = args.periodType === "TRIAL";
  const isPromo = args.type === "NON_RENEWING_PURCHASE";

  const HEADLINES: Record<string, string> = {
    INITIAL_PURCHASE: isTrial
      ? ":gift: Free trial started"
      : ":moneybag: New subscription",
    RENEWAL: ":arrows_counterclockwise: Subscription renewed",
    UNCANCELLATION: ":leftwards_arrow_with_hook: Subscription uncancelled",
    NON_RENEWING_PURCHASE: ":tickets: Promo entitlement granted",
    PRODUCT_CHANGE: ":twisted_rightwards_arrows: Plan changed",
    CANCELLATION: ":warning: Subscription cancelled (auto-renew off)",
    EXPIRATION: ":x: Subscription expired",
    BILLING_ISSUE: ":rotating_light: Billing issue",
  };
  const headline = HEADLINES[args.type] ?? `:information_source: ${args.type}`;

  let headlineText = `${isStaging ? "[STAGING] " : ""}*${headline}*`;
  if (args.isFirstPurchase) headlineText += "  :star2: _first-time buyer_";

  const fields: { type: "mrkdwn"; text: string }[] = [];
  fields.push({ type: "mrkdwn", text: `*Customer*\n${args.displayName}` });
  if (args.email)
    fields.push({ type: "mrkdwn", text: `*Email*\n\`${args.email}\`` });
  if (args.tier) fields.push({ type: "mrkdwn", text: `*Tier*\n${args.tier}` });

  const productText =
    args.type === "PRODUCT_CHANGE" && args.newProductId
      ? `\`${args.productId ?? "?"}\` → \`${args.newProductId}\``
      : `\`${args.productId ?? "(unknown)"}\``;
  fields.push({ type: "mrkdwn", text: `*Product*\n${productText}` });

  if (MONEY_EVENTS.has(args.type) && args.priceUsd != null) {
    let amount = `$${args.priceUsd.toFixed(2)}`;
    if (args.priceLocal != null && args.currency && args.currency !== "USD") {
      amount += ` (${args.priceLocal.toFixed(2)} ${args.currency})`;
    }
    fields.push({ type: "mrkdwn", text: `*Amount*\n${amount}` });
  }

  const kind = isPromo
    ? "Promo grant"
    : isTrial
    ? "Free trial"
    : MONEY_EVENTS.has(args.type)
    ? "Paid"
    : "—";
  fields.push({ type: "mrkdwn", text: `*Kind*\n${kind}` });

  if (args.store) fields.push({ type: "mrkdwn", text: `*Store*\n${args.store}` });
  if (args.countryCode)
    fields.push({ type: "mrkdwn", text: `*Country*\n${args.countryCode}` });

  if (args.expirationAtMs) {
    const unix = Math.floor(args.expirationAtMs / 1000);
    const iso = new Date(args.expirationAtMs).toISOString();
    const label =
      args.type === "EXPIRATION"
        ? "Expired"
        : args.type === "CANCELLATION"
        ? "Access until"
        : "Renews";
    fields.push({
      type: "mrkdwn",
      text: `*${label}*\n<!date^${unix}^{date_short_pretty}|${iso}>`,
    });
  }

  if (args.lifetimeRevenueCents > 0) {
    fields.push({
      type: "mrkdwn",
      text: `*Lifetime revenue*\n$${(args.lifetimeRevenueCents / 100).toFixed(2)}`,
    });
  }

  // Slack caps a section at 10 fields.
  const cappedFields = fields.slice(0, 10);

  const contextParts = [`app_user_id: \`${args.appUserId}\``];
  if (args.environment) contextParts.push(`env: ${args.environment}`);
  if (args.environment === "SANDBOX")
    contextParts.push(":test_tube: SANDBOX — test purchase");

  const payload = {
    text: `${isStaging ? "[STAGING] " : ""}${args.type} — ${args.displayName}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: headlineText },
      },
      { type: "section", fields: cappedFields },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: contextParts.join("  ·  ") },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable body)");
      console.error(
        "[RC Webhook] Revenue Slack webhook returned non-OK:",
        res.status,
        body
      );
    } else {
      console.log(
        "[RC Webhook] Revenue Slack posted for",
        args.type,
        args.email ?? args.appUserId
      );
    }
  } catch (err) {
    console.error("[RC Webhook] Revenue Slack POST failed:", err);
  }
}

revenuecatWebhookRoutes.post("/revenuecat-webhook", async (req, res) => {
  try {
    // Verify Authorization header
    const authHeader = req.headers.authorization;
    const expectedAuth = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (expectedAuth && authHeader !== expectedAuth) {
      console.error("[RC Webhook] Invalid authorization header");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = req.body;
    const ev = payload.event || {};
    const {
      type,
      app_user_id,
      product_id,
      new_product_id,
      entitlement_ids,
      expiration_at_ms,
      price,
      price_in_purchased_currency,
      currency,
      period_type,
      store,
      country_code,
      environment,
    } = ev;

    console.log(
      "[RC Webhook] Event:",
      type,
      "User:",
      app_user_id,
      "Product:",
      product_id,
      "New product:",
      new_product_id,
      "Entitlements:",
      entitlement_ids
    );

    if (!app_user_id) {
      console.warn("[RC Webhook] No app_user_id in event");
      res.status(200).json({ ok: true });
      return;
    }

    const profileQuery = await colRef("userProfiles")
      .where("userId", "==", app_user_id)
      .limit(1)
      .get();

    if (profileQuery.empty) {
      console.warn("[RC Webhook] No profile found for user:", app_user_id);
      res.status(200).json({ ok: true });
      return;
    }

    const profileDoc = profileQuery.docs[0];
    const profileRef = profileDoc.ref;

    // Common props for every analytics event we emit from this webhook
    const baseEventProps = {
      tier: tierFromEntitlements(entitlement_ids) ?? tierFromProductId(product_id),
      product_id: product_id ?? null,
      price: typeof price_in_purchased_currency === "number" ? price_in_purchased_currency : null,
      currency: currency ?? null,
      expiration_at_ms: expiration_at_ms ?? null,
      period_type: period_type ?? null,
    };

    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION": {
        // Source of truth: entitlement_ids from RC. Fall back to product_id
        // naming convention only if entitlement_ids is missing.
        const tier =
          tierFromEntitlements(entitlement_ids) ??
          tierFromProductId(product_id);
        if (!tier) {
          console.warn(
            "[RC Webhook] Could not resolve tier for event",
            type,
            { entitlement_ids, product_id }
          );
          break;
        }

        const updates: Record<string, any> = {
          subscriptionStatus: tier,
          // Real purchase / renewal / uncancellation = store-sourced.
          // The /redeem-promo endpoint sets "promo" when a promo grant
          // is the winning tier; this overwrites it correctly when a
          // real purchase later supersedes a promo.
          subscriptionSource: "store",
        };
        if (expiration_at_ms) {
          updates.trialEndDate = new Date(expiration_at_ms);
        }

        // Mirror revenue + purchase timestamps to the userProfile so per-user
        // dashboards can compute LTV / time-to-paid without scanning RC.
        const now = new Date();
        const priceCents =
          typeof price_in_purchased_currency === "number"
            ? Math.round(price_in_purchased_currency * 100)
            : 0;
        const profileData = profileDoc.data() as {
          firstPurchaseAt?: any;
          lifetimeRevenueCents?: number;
          everUsedFreeTrial?: boolean;
        };
        if (type === "INITIAL_PURCHASE" && !profileData.firstPurchaseAt) {
          updates.firstPurchaseAt = now;
        }
        if (type === "INITIAL_PURCHASE" || type === "RENEWAL") {
          updates.lastPurchaseAt = now;
          if (priceCents > 0) {
            // Use FieldValue.increment so concurrent renewals don't clobber
            // each other (rare but possible).
            updates.lifetimeRevenueCents =
              admin.firestore.FieldValue.increment(priceCents);
          }
        }
        if (period_type === "TRIAL" && !profileData.everUsedFreeTrial) {
          updates.everUsedFreeTrial = true;
        }

        await profileRef.update(updates);
        console.log("[RC Webhook] Updated profile to:", tier);

        // Welcome push for first paid purchase (not trial starts).
        // Fires immediately via webhook so the user gets it right after checkout,
        // not at the next daily cron window.
        if (type === "INITIAL_PURCHASE" && period_type !== "TRIAL") {
          try {
            const profilePrefs = (profileDoc.data() as any)?.notificationPreferences as Record<string, boolean> | undefined;
            const template = await getTemplate("welcome_to_premium");
            const category = TEMPLATE_CATEGORY["welcome_to_premium"];
            if (template?.enabled && profilePrefs?.[category] !== false) {
              const title = renderString(template.title, {});
              const body = renderString(template.body, {});
              const data = template.deepLink
                ? { deepLink: template.deepLink, templateKey: "welcome_to_premium" }
                : { templateKey: "welcome_to_premium" };
              await sendToUser(app_user_id, { title, body, data }, { templateKey: "welcome_to_premium" });
            }
          } catch (err) {
            console.warn("[RC Webhook] welcome_to_premium push failed:", err);
          }
        }

        // Fire ad platform conversions for INITIAL_PURCHASE (new sub).
        // RENEWAL is excluded — those are not acquisition events.
        // Awaited (not void'd): once res.json sends, Cloud Run throttles
        // CPU and an un-awaited fetch to Meta never completes.
        // fanOutConversion swallows all errors internally.
        if (type === "INITIAL_PURCHASE") {
          const isTrial = period_type === "TRIAL";
          const email = (profileDoc.data() as { email?: string }).email ?? null;
          await fanOutConversion({
            kind: isTrial ? "start_trial" : "purchase",
            userId: app_user_id,
            email,
            amountUsd:
              typeof price_in_purchased_currency === "number"
                ? price_in_purchased_currency
                : undefined,
            currency: currency ?? "USD",
            productId: product_id ?? undefined,
          });
        }

        // Analytics
        if (type === "INITIAL_PURCHASE") {
          const isTrial = period_type === "TRIAL";
          await logAnalyticsEvent(
            isTrial ? "trial_started_server" : "subscription_started",
            app_user_id,
            { ...baseEventProps, tier }
          );
        } else if (type === "RENEWAL") {
          await logAnalyticsEvent("subscription_renewed", app_user_id, {
            ...baseEventProps,
            tier,
          });
        } else {
          await logAnalyticsEvent("subscription_uncanceled", app_user_id, {
            ...baseEventProps,
            tier,
          });
        }
        break;
      }

      case "NON_RENEWING_PURCHASE": {
        // RC fires this for promotional entitlements granted via the API
        // (e.g. our /redeem-promo endpoint). Same effect on subscription
        // status as INITIAL_PURCHASE — but we skip ad conversion fanout
        // (these aren't real acquisitions) and log a separate analytics
        // event so promos are distinguishable from real purchases.
        const tier =
          tierFromEntitlements(entitlement_ids) ??
          tierFromProductId(product_id);
        if (!tier) {
          console.warn(
            "[RC Webhook] Could not resolve tier for NON_RENEWING_PURCHASE",
            { entitlement_ids, product_id }
          );
          break;
        }
        const updates: Record<string, any> = {
          subscriptionStatus: tier,
          subscriptionSource: "promo",
        };
        if (expiration_at_ms) {
          updates.trialEndDate = new Date(expiration_at_ms);
        }
        await profileRef.update(updates);
        console.log("[RC Webhook] NON_RENEWING_PURCHASE applied:", tier);

        await logAnalyticsEvent("subscription_started_promo", app_user_id, {
          ...baseEventProps,
          tier,
        });
        break;
      }

      case "PRODUCT_CHANGE": {
        // For tier upgrades (e.g. Premium → Business), the change takes
        // effect immediately and entitlement_ids reflects the new tier.
        // For tier downgrades or billing-period changes that Apple queues
        // until period end, the user still has their existing entitlement.
        // In both cases, entitlement_ids is the correct source of truth.
        // Fall back to new_product_id (the product being switched TO) if
        // entitlements are missing, NOT product_id (the old product).
        const tier =
          tierFromEntitlements(entitlement_ids) ??
          tierFromProductId(new_product_id) ??
          tierFromProductId(product_id);
        if (!tier) {
          console.warn(
            "[RC Webhook] Could not resolve tier for PRODUCT_CHANGE",
            { entitlement_ids, product_id, new_product_id }
          );
          break;
        }

        const updates: Record<string, any> = {
          subscriptionStatus: tier,
          subscriptionSource: "store",
        };
        if (expiration_at_ms) {
          updates.trialEndDate = new Date(expiration_at_ms);
        }
        await profileRef.update(updates);
        console.log("[RC Webhook] PRODUCT_CHANGE applied:", tier);

        await logAnalyticsEvent("subscription_changed", app_user_id, {
          ...baseEventProps,
          tier,
          from_product: product_id ?? null,
          to_product: new_product_id ?? null,
        });
        break;
      }

      case "CANCELLATION": {
        // User turned off auto-renew but access continues until expiration.
        // Do NOT flip to free yet — just log for observability.
        console.log(
          "[RC Webhook] User cancelled (access continues until expiration):",
          app_user_id
        );
        await logAnalyticsEvent("subscription_canceled", app_user_id, baseEventProps);
        break;
      }

      case "EXPIRATION": {
        // Don't blindly reset to free. The user may have other active
        // entitlements (e.g. a real Premium expired but a Business promo
        // is still valid, or vice-versa). Query RC for what remains and
        // pick the highest-ranked tier among those.
        //
        // We deliberately leave subscriptionSource alone when something
        // remains: V2's active_entitlements payload doesn't expose the
        // source (store vs promotional), so the safest move is "don't
        // overwrite". The next webhook that does carry source info
        // (INITIAL_PURCHASE / NON_RENEWING_PURCHASE / etc.) will correct it.
        let remaining: Awaited<ReturnType<typeof listActiveEntitlements>> = [];
        try {
          remaining = await listActiveEntitlements(app_user_id);
        } catch (err) {
          console.warn(
            `[RC Webhook] EXPIRATION: failed to fetch active entitlements for ${app_user_id}; falling back to free:`,
            err
          );
        }

        const TIER_RANK: Record<string, number> = { premium: 2, business: 3 };
        const tieredRemaining = remaining.filter(
          (e) => typeof TIER_RANK[e.entitlement_id] === "number"
        );

        if (tieredRemaining.length === 0) {
          await profileRef.update({
            subscriptionStatus: "free",
            subscriptionSource: null,
            trialEndDate: null,
          });
          console.log(
            "[RC Webhook] EXPIRATION: no entitlements remain, reset to free"
          );
        } else {
          tieredRemaining.sort(
            (a, b) => TIER_RANK[b.entitlement_id] - TIER_RANK[a.entitlement_id]
          );
          const winner = tieredRemaining[0];
          const winnerTier = winner.entitlement_id as "premium" | "business";
          const updates: Record<string, any> = { subscriptionStatus: winnerTier };
          if (winner.expires_at) {
            updates.trialEndDate = new Date(winner.expires_at);
          }
          await profileRef.update(updates);
          console.log(
            `[RC Webhook] EXPIRATION: ${tieredRemaining.length} entitlement(s) remain; set to ${winnerTier}`
          );
        }
        await logAnalyticsEvent("subscription_expired", app_user_id, baseEventProps);
        break;
      }

      case "BILLING_ISSUE": {
        // Leave active — RC will retry and send RENEWAL or EXPIRATION later
        console.log("[RC Webhook] Billing issue for user:", app_user_id);
        await logAnalyticsEvent("billing_issue", app_user_id, baseEventProps);

        // Notify the user that their renewal failed so they can update
        // payment before access lapses. Gated on the template being
        // enabled in the admin so Trevor can switch this off if desired.
        try {
          const billingProfileSnap = await colRef("userProfiles").where("userId", "==", app_user_id).limit(1).get();
          const billingPrefs = billingProfileSnap.empty ? undefined : (billingProfileSnap.docs[0].data()?.notificationPreferences as Record<string, boolean> | undefined);
          const template = await getTemplate("billing_issue");
          const billingCategory = TEMPLATE_CATEGORY["billing_issue"];
          if (template?.enabled && billingPrefs?.[billingCategory] !== false) {
            const title = renderString(template.title, {});
            const body = renderString(template.body, {});
            const data = template.deepLink
              ? { deepLink: template.deepLink, templateKey: "billing_issue" }
              : { templateKey: "billing_issue" };
            await sendToUser(
              app_user_id,
              { title, body, data },
              { templateKey: "billing_issue" }
            );
          }
        } catch (err) {
          console.warn("[RC Webhook] billing_issue push failed:", err);
        }
        break;
      }

      default: {
        console.log("[RC Webhook] Unhandled event type:", type);
      }
    }

    // Custom revenue Slack post — fires for EVERY event type, including
    // the `default` (unhandled) branch above, so nothing slips by
    // silently. Runs alongside RevenueCat's native Slack integration.
    // Awaited (not void'd): once res.json sends, Cloud Run throttles CPU
    // and an un-awaited fetch never completes. sendRevenueSlack swallows
    // all errors internally, so awaiting it can't break the webhook.
    {
      const slackTier =
        tierFromEntitlements(entitlement_ids) ??
        tierFromProductId(product_id) ??
        tierFromProductId(new_product_id);
      const pd = profileDoc.data() as {
        displayName?: string;
        email?: string;
        firstPurchaseAt?: any;
        lifetimeRevenueCents?: number;
      };
      const slackPriceUsd = typeof price === "number" ? price : null;
      const slackPriceLocal =
        typeof price_in_purchased_currency === "number"
          ? price_in_purchased_currency
          : null;
      // profileDoc is the pre-update snapshot, so lifetimeRevenueCents
      // here excludes the current transaction — add it back for
      // purchase / renewal events so the figure reflects "after this".
      const txnCents =
        slackPriceUsd != null ? Math.round(slackPriceUsd * 100) : 0;
      const purchaseLike = type === "INITIAL_PURCHASE" || type === "RENEWAL";
      await sendRevenueSlack({
        type: typeof type === "string" ? type : "(unknown)",
        displayName: pd.displayName || "(no name)",
        email: pd.email ?? null,
        appUserId: app_user_id,
        tier: slackTier,
        productId: typeof product_id === "string" ? product_id : null,
        newProductId:
          typeof new_product_id === "string" ? new_product_id : null,
        priceUsd: slackPriceUsd,
        priceLocal: slackPriceLocal,
        currency: typeof currency === "string" ? currency : null,
        periodType: typeof period_type === "string" ? period_type : null,
        store: typeof store === "string" ? store : null,
        countryCode: typeof country_code === "string" ? country_code : null,
        environment: typeof environment === "string" ? environment : null,
        expirationAtMs:
          typeof expiration_at_ms === "number" ? expiration_at_ms : null,
        isFirstPurchase:
          type === "INITIAL_PURCHASE" && !pd.firstPurchaseAt,
        lifetimeRevenueCents:
          (pd.lifetimeRevenueCents ?? 0) + (purchaseLike ? txnCents : 0),
      });
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[RC Webhook] Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
