import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    from?: string;
    subject?: string;
    created_at?: string;
    clicked_link?: {
      url?: string;
    };
    click?: {
      url?: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const EVENT_TO_STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.complained": "complained",
  "email.bounced": "bounced",
  "email.opened": "opened",
  "email.clicked": "clicked",
};

function getClickedUrl(payload: ResendWebhookPayload) {
  return payload.data?.clicked_link?.url ?? payload.data?.click?.url ?? null;
}

function getRecipientEmail(payload: ResendWebhookPayload) {
  const to = payload.data?.to;
  if (Array.isArray(to)) return to[0] ?? null;
  return to ?? null;
}

function isAllowedEvent(type: string | undefined) {
  if (!type) return false;
  return type in EVENT_TO_STATUS;
}

function getSvixSignatures(signatureHeader: string) {
  return signatureHeader
    .split(" ")
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("v1,")) return part.slice(3);
      if (part.startsWith("v1=")) return part.slice(3);
      return part;
    });
}

function verifyResendSignature(request: Request, rawBody: string) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true;

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const timestamp = Number(svixTimestamp);
  if (!Number.isFinite(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 60 * 5;
  if (Math.abs(now - timestamp) > fiveMinutes) return false;

  const secretWithoutPrefix = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = Buffer.from(secretWithoutPrefix, "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", key).update(signedContent).digest("base64");
  const expected = Buffer.from(expectedSignature);

  return getSvixSignatures(svixSignature).some((signature) => {
    const actual = Buffer.from(signature);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export async function POST(request: Request) {
  const configuredToken = process.env.RESEND_WEBHOOK_TOKEN;

  if (configuredToken) {
    const incomingToken = request.headers.get("x-webhook-token");
    if (incomingToken !== configuredToken) {
      return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
    }
  }

  const rawBody = await request.text();
  const signatureOk = verifyResendSignature(request, rawBody);

  if (!signatureOk) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: ResendWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (!isAllowedEvent(payload.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const emailId = payload.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ error: "Webhook without email_id." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existingLogs, error: logError } = await supabase
    .from("message_logs")
    .select("id, restaurant_id, campaign_id, customer_id, status")
    .eq("external_id", emailId)
    .limit(1);

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  const existingLog = existingLogs?.[0] ?? null;
  if (!existingLog) {
    return NextResponse.json({ received: true, stored: false, reason: "message_log_not_found" });
  }

  const eventType = payload.type!;
  const eventStatus = EVENT_TO_STATUS[eventType];
  const eventCreatedAt = payload.created_at ?? payload.data?.created_at ?? new Date().toISOString();
  const clickedUrl = getClickedUrl(payload);
  const recipientEmail = getRecipientEmail(payload);

  await supabase.from("email_events").insert({
    restaurant_id: existingLog.restaurant_id,
    campaign_id: existingLog.campaign_id,
    message_log_id: existingLog.id,
    customer_id: existingLog.customer_id,
    provider: "resend",
    provider_message_id: emailId,
    event_type: eventType,
    event_status: eventStatus,
    recipient_email: recipientEmail,
    clicked_url: clickedUrl,
    raw_payload: payload,
    occurred_at: eventCreatedAt,
  });

  const updates: Record<string, string | boolean | null> = {
    last_event_type: eventType,
    last_event_at: eventCreatedAt,
  };

  if (eventType === "email.delivered") {
    updates.delivered_at = eventCreatedAt;
  }

  if (eventType === "email.opened") {
    updates.opened_at = eventCreatedAt;
    updates.opened = true;
  }

  if (eventType === "email.clicked") {
    updates.clicked_at = eventCreatedAt;
    updates.clicked = true;
    updates.clicked_url = clickedUrl;
  }

  if (eventType === "email.bounced" || eventType === "email.complained") {
    updates.status = "failed";
    updates.error_message = eventType;
  }

  await supabase
    .from("message_logs")
    .update(updates)
    .eq("id", existingLog.id);

  return NextResponse.json({ received: true });
}
