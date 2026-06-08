import { createClient as createAdminClient } from "@supabase/supabase-js";

const URL_REGEX = /https?:\/\/[^\s"'<>]+/g;

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function createTrackedLink(opts: {
  restaurantId: string;
  campaignId: string;
  customerId: string;
  messageLogId?: string;
  originalUrl: string;
  channel: string;
}): Promise<string> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("tracked_links")
    .insert({
      restaurant_id: opts.restaurantId,
      campaign_id: opts.campaignId,
      customer_id: opts.customerId,
      message_log_id: opts.messageLogId ?? null,
      original_url: opts.originalUrl,
      channel: opts.channel,
    })
    .select("token")
    .single();

  if (error || !data) throw new Error("Erro ao criar link rastreado");

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://crm-lafraiarafael.vercel.app";
  return `${base}/r/${data.token}`;
}

export async function replaceLinksWithTracked(opts: {
  message: string;
  restaurantId: string;
  campaignId: string;
  customerId: string;
  channel: string;
}): Promise<string> {
  const urls = opts.message.match(URL_REGEX);
  if (!urls) return opts.message;

  let result = opts.message;

  for (const url of [...new Set(urls)]) {
    try {
      const tracked = await createTrackedLink({
        restaurantId: opts.restaurantId,
        campaignId: opts.campaignId,
        customerId: opts.customerId,
        originalUrl: url,
        channel: opts.channel,
      });
      result = result.replaceAll(url, tracked);
    } catch {
      // Se falhar, manter URL original
    }
  }

  return result;
}
