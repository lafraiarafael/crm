import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error || !data?.restaurant_id) return null;
  return data.restaurant_id as string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const restaurantId = await getRestaurantId(supabase, user.id);
  if (!restaurantId) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, channel, status, subject, created_at, sent_at, total_recipients, total_sent, total_failed")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: campaigns ?? [] });
}

const campaignSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres."),
  channel: z.enum(["email", "whatsapp"]),
  message: z.string().min(1, "Mensagem é obrigatória."),
  subject: z.string().optional().nullable(),
  customer_ids: z.array(z.string().uuid()).min(1, "Selecione pelo menos 1 cliente."),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const restaurantId = await getRestaurantId(supabase, user.id);
  if (!restaurantId) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });

  const body = await request.json();
  const parsed = campaignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const { name, channel, message, subject, customer_ids } = parsed.data;

  // Criar campanha
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      restaurant_id: restaurantId,
      name,
      channel,
      message,
      subject: subject ?? null,
      status: "draft",
      total_recipients: customer_ids.length,
    })
    .select()
    .single();

  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message ?? "Erro ao criar campanha." }, { status: 500 });

  // Vincular clientes
  const links = customer_ids.map(cid => ({
    campaign_id: campaign.id,
    customer_id: cid,
    restaurant_id: restaurantId,
  }));

  const { error: linkError } = await supabase.from("campaign_customers").insert(links);
  if (linkError) {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return NextResponse.json({ error: "Erro ao vincular clientes." }, { status: 500 });
  }

  return NextResponse.json({ campaign }, { status: 201 });
}

