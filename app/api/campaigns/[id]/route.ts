import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendCampaignEmail } from "@/lib/resend";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source?: string | null;
};

type Campaign = {
  id: string;
  restaurant_id: string;
  name: string;
  channel: "email" | "whatsapp";
  status: "draft" | "scheduled" | "sent" | "failed" | "paused";
  subject: string | null;
  message: string;
  email_html: string | null;
  created_at: string;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_failed: number;
};

type MessageLog = {
  id: string;
  customer_id: string | null;
  channel: "email" | "whatsapp";
  status: string;
  provider: string | null;
  external_id: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  opened: boolean;
  clicked: boolean;
  clicked_url: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
};

async function resolveRestaurantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", userId)
    .limit(1);

  const restaurantUser = data?.[0] ?? null;

  if (error || !restaurantUser?.restaurant_id) {
    return null;
  }

  return restaurantUser.restaurant_id as string;
}

function personalizeContent(content: string, customer: Customer | null) {
  const fullName = customer?.full_name ?? "cliente";
  const firstName = customer?.full_name?.trim().split(/\s+/)[0] ?? "cliente";

  return content
    .replaceAll("${name}", firstName)
    .replaceAll("{{name}}", firstName)
    .replaceAll("{nome}", firstName)
    .replaceAll("{nome_completo}", fullName);
}

function textToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (line ? `<p>${line}</p>` : "<br />"))
    .join("\n");
}

function buildTrackingMetrics(logs: MessageLog[]) {
  const total = logs.length;
  const sent = logs.filter((log) => log.status === "sent" || Boolean(log.sent_at)).length;
  const delivered = logs.filter((log) => Boolean(log.delivered_at)).length;
  const opened = logs.filter((log) => log.opened || Boolean(log.opened_at)).length;
  const clicked = logs.filter((log) => log.clicked || Boolean(log.clicked_at)).length;
  const failed = logs.filter((log) => log.status === "failed").length;
  const bounced = logs.filter((log) => log.last_event_type === "email.bounced").length;
  const complained = logs.filter((log) => log.last_event_type === "email.complained").length;

  return {
    total,
    sent,
    delivered,
    opened,
    clicked,
    failed,
    bounced,
    complained,
    delivery_rate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
    open_rate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
    click_rate: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
  };
}

async function loadCampaignContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  restaurantId: string
) {
  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "id, restaurant_id, name, channel, status, subject, message, email_html, created_at, sent_at, total_recipients, total_sent, total_failed"
    )
    .eq("id", campaignId)
    .eq("restaurant_id", restaurantId)
    .limit(1);

  const campaign = (campaigns?.[0] ?? null) as Campaign | null;

  if (campaignError || !campaign) {
    return { campaign: null, recipients: [], error: campaignError?.message ?? "Campanha não encontrada." };
  }

  const { data: campaignCustomers, error: recipientsError } = await supabase
    .from("campaign_customers")
    .select("id, customer_id, created_at")
    .eq("campaign_id", campaignId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (recipientsError) {
    return { campaign, recipients: [], error: recipientsError.message };
  }

  const customerIds = (campaignCustomers ?? [])
    .map((row) => row.customer_id as string | null)
    .filter((id): id is string => Boolean(id));

  const customersById = new Map<string, Customer>();

  if (customerIds.length > 0) {
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, source")
      .eq("restaurant_id", restaurantId)
      .in("id", customerIds);

    if (customersError) {
      return { campaign, recipients: [], error: customersError.message };
    }

    for (const customer of (customers ?? []) as Customer[]) {
      customersById.set(customer.id, customer);
    }
  }

  const recipients = (campaignCustomers ?? []).map((row) => ({
    id: row.id as string,
    customer_id: row.customer_id as string,
    customer: customersById.get(row.customer_id as string) ?? null,
  }));

  return { campaign, recipients, error: null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: campaignId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const restaurantId = await resolveRestaurantId(supabase, user.id);

  if (!restaurantId) {
    return NextResponse.json(
      { error: "Restaurante não encontrado para o usuário." },
      { status: 403 }
    );
  }

  const { campaign, recipients, error } = await loadCampaignContext(supabase, campaignId, restaurantId);

  if (error || !campaign) {
    return NextResponse.json({ error: error ?? "Campanha não encontrada." }, { status: 404 });
  }

  const { data: logs, error: logsError } = await supabase
    .from("message_logs")
    .select("id, customer_id, channel, status, provider, external_id, error_message, created_at, sent_at, delivered_at, opened_at, clicked_at, opened, clicked, clicked_url, last_event_type, last_event_at")
    .eq("campaign_id", campaignId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  const messageLogs = (logs ?? []) as MessageLog[];

  const { data: events, error: eventsError } = await supabase
    .from("email_events")
    .select("id, message_log_id, customer_id, event_type, event_status, recipient_email, clicked_url, occurred_at, created_at")
    .eq("campaign_id", campaignId)
    .eq("restaurant_id", restaurantId)
    .order("occurred_at", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  return NextResponse.json({
    campaign,
    recipients,
    logs: messageLogs,
    email_events: events ?? [],
    tracking: buildTrackingMetrics(messageLogs),
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: campaignId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const restaurantId = await resolveRestaurantId(supabase, user.id);

  if (!restaurantId) {
    return NextResponse.json(
      { error: "Restaurante não encontrado para o usuário." },
      { status: 403 }
    );
  }

  const { campaign, recipients, error } = await loadCampaignContext(supabase, campaignId, restaurantId);

  if (error || !campaign) {
    return NextResponse.json({ error: error ?? "Campanha não encontrada." }, { status: 404 });
  }

  if (campaign.channel !== "email") {
    return NextResponse.json({ error: "Esta rota envia apenas campanhas de email." }, { status: 400 });
  }

  if (!campaign.subject?.trim()) {
    return NextResponse.json({ error: "Campanha de email precisa de assunto." }, { status: 400 });
  }

  const validRecipients = recipients.filter((recipient) => recipient.customer?.email);

  if (validRecipients.length === 0) {
    return NextResponse.json({ error: "Nenhum destinatário com email válido." }, { status: 400 });
  }

  await supabase
    .from("campaigns")
    .update({ status: "scheduled", total_recipients: validRecipients.length })
    .eq("id", campaignId)
    .eq("restaurant_id", restaurantId);

  let totalSent = 0;
  let totalFailed = 0;

  for (const recipient of validRecipients) {
    const customer = recipient.customer;
    const personalizedText = personalizeContent(campaign.message, customer);
    const personalizedHtml = campaign.email_html
      ? personalizeContent(campaign.email_html, customer)
      : textToHtml(personalizedText);

    const result = await sendCampaignEmail({
      to: customer!.email!,
      subject: campaign.subject,
      text: personalizedText,
      html: personalizedHtml,
      fromName: "Curry Pasta",
    });

    const status = result.success ? "sent" : "failed";
    if (result.success) totalSent += 1;
    else totalFailed += 1;

    await supabase.from("message_logs").insert({
      restaurant_id: restaurantId,
      campaign_id: campaignId,
      customer_id: customer?.id ?? null,
      channel: "email",
      status,
      provider: result.provider,
      external_id: result.externalId ?? null,
      error_message: result.error ?? null,
      sent_at: result.success ? new Date().toISOString() : null,
    });
  }

  const finalStatus = totalFailed > 0 && totalSent === 0 ? "failed" : "sent";

  const { data: updatedCampaign, error: updateError } = await supabase
    .from("campaigns")
    .update({
      status: finalStatus,
      total_recipients: validRecipients.length,
      total_sent: totalSent,
      total_failed: totalFailed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("restaurant_id", restaurantId)
    .select("id, name, channel, status, subject, created_at, sent_at, total_recipients, total_sent, total_failed")
    .limit(1);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    campaign: updatedCampaign?.[0] ?? null,
    total_sent: totalSent,
    total_failed: totalFailed,
  });
}
