import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return data?.restaurant_id as string | null;
}

function renderMessage(template: string, name: string): string {
  return template
    .replace(/\{nome\}/gi, name)
    .replace(/\{nome_completo\}/gi, name)
    .replace(/\$\{name\}/g, name)
    .replace(/\{\{name\}\}/g, name);
}

// Criar link rastreado no Worker do Cloudflare
async function createTrackedLink(params: {
  campaignId: string;
  customerId: string;
  customerName: string;
  destinationUrl: string;
}): Promise<string | null> {
  const trackerUrl = process.env.LINK_TRACKER_URL;
  const trackerSecret = process.env.LINK_TRACKER_SECRET;
  if (!trackerUrl || !trackerSecret) return null;

  try {
    const res = await fetch(`${trackerUrl}/api/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": trackerSecret,
      },
      body: JSON.stringify({
        campaign_id: params.campaignId,
        customer_id: params.customerId,
        customer_name: params.customerName,
        destination_url: params.destinationUrl,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const data = await res.json() as { short_url: string };
    return data.short_url ?? null;
  } catch {
    return null;
  }
}

// Substituir URLs na mensagem por links rastreados
async function replaceUrlsWithTracked(
  message: string,
  campaignId: string,
  customerId: string,
  customerName: string
): Promise<string> {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = message.match(urlRegex);
  if (!urls) return message;

  let result = message;
  for (const url of urls) {
    const tracked = await createTrackedLink({
      campaignId,
      customerId,
      customerName,
      destinationUrl: url,
    });
    if (tracked) {
      result = result.replace(url, tracked);
    }
  }
  return result;
}

type CustomerRow = { id: string; full_name: string; phone: string };

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const restaurantId = await getRestaurantId(supabase, user.id);
  if (!restaurantId) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, channel, message, status, restaurant_id")
    .eq("id", campaignId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  if (campaign.channel !== "whatsapp") return NextResponse.json({ error: "Esta campanha não é de WhatsApp." }, { status: 400 });
  if (campaign.status === "sent") return NextResponse.json({ error: "Campanha já foi enviada." }, { status: 400 });

  const { data: waSession } = await supabase
    .from("whatsapp_sessions")
    .select("status")
    .eq("restaurant_id", restaurantId)
    .eq("provider", "baileys")
    .single();

  if (!waSession || waSession.status !== "connected") {
    return NextResponse.json(
      { error: "WhatsApp não está conectado. Acesse /dashboard/whatsapp para conectar." },
      { status: 400 }
    );
  }

  const { data: links } = await supabase
    .from("campaign_customers")
    .select("customer_id, customers(id, full_name, phone)")
    .eq("campaign_id", campaignId);

  const customers = (links ?? [])
    .map(l => l.customers as unknown as CustomerRow | null)
    .filter((c): c is CustomerRow => !!c?.phone);

  if (customers.length === 0) {
    return NextResponse.json({ error: "Nenhum cliente com telefone nesta campanha." }, { status: 400 });
  }

  await supabase.from("campaigns").update({ status: "scheduled" }).eq("id", campaignId);

  let sent = 0;
  let failed = 0;

  type LogRow = {
    campaign_id: string; customer_id: string; restaurant_id: string;
    channel: string; status: string; error_message: string | null;
    sent_at: string | null; message_text: string;
  };
  const logs: LogRow[] = [];

  for (const customer of customers) {
    // Renderizar mensagem com nome do cliente
    const rendered = renderMessage(campaign.message as string, customer.full_name);

    // Substituir URLs por links rastreados únicos por cliente
    const body = await replaceUrlsWithTracked(rendered, campaignId, customer.id, customer.full_name);

    try {
      await sendWhatsAppMessage({ restaurantId, phone: customer.phone, message: body });
      sent++;
      logs.push({
        campaign_id: campaignId, customer_id: customer.id, restaurant_id: restaurantId,
        channel: "whatsapp", status: "sent", error_message: null,
        sent_at: new Date().toISOString(), message_text: body,
      });
    } catch (err) {
      failed++;
      logs.push({
        campaign_id: campaignId, customer_id: customer.id, restaurant_id: restaurantId,
        channel: "whatsapp", status: "failed",
        error_message: err instanceof Error ? err.message : "Erro desconhecido",
        sent_at: null, message_text: body,
      });
    }
  }

  if (logs.length > 0) await supabase.from("message_logs").insert(logs);

  await supabase.from("campaigns").update({
    status: failed === customers.length ? "failed" : "sent",
    sent_at: new Date().toISOString(),
    total_sent: sent,
    total_failed: failed,
  }).eq("id", campaignId);

  return NextResponse.json({ sent, failed, total: customers.length });
}
