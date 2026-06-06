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

export async function POST(request: Request) {
  const configuredSecret = process.env.RESEND_WEBHOOK_TOKEN;

  if (configuredSecret) {
    const incomingSecret = request.headers.get("x-webhook-token");
    if (incomingSecret !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
    }
  }

  const payload = (await request.json()) as ResendWebhookPayload;

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
