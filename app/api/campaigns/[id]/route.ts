import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "id, restaurant_id, name, channel, status, subject, message, created_at, sent_at, total_recipients, total_sent, total_failed"
    )
    .eq("id", campaignId)
    .eq("restaurant_id", restaurantId)
    .limit(1);

  const campaign = campaigns?.[0] ?? null;

  if (campaignError || !campaign) {
    return NextResponse.json(
      { error: campaignError?.message ?? "Campanha não encontrada." },
      { status: 404 }
    );
  }

  const { data: campaignCustomers, error: recipientsError } = await supabase
    .from("campaign_customers")
    .select("id, customer_id, created_at")
    .eq("campaign_id", campaignId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (recipientsError) {
    return NextResponse.json({ error: recipientsError.message }, { status: 500 });
  }

  const customerIds = (campaignCustomers ?? [])
    .map((row) => row.customer_id as string | null)
    .filter((id): id is string => Boolean(id));

  let customersById = new Map<string, unknown>();

  if (customerIds.length > 0) {
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id, full_name, email, phone, source")
      .eq("restaurant_id", restaurantId)
      .in("id", customerIds);

    if (customersError) {
      return NextResponse.json({ error: customersError.message }, { status: 500 });
    }

    customersById = new Map((customers ?? []).map((customer) => [customer.id, customer]));
  }

  const recipients = (campaignCustomers ?? []).map((row) => ({
    id: row.id,
    customer_id: row.customer_id,
    customer: customersById.get(row.customer_id) ?? null,
  }));

  const { data: logs, error: logsError } = await supabase
    .from("message_logs")
    .select("id, customer_id, channel, status, provider, external_id, error_message, created_at, sent_at")
    .eq("campaign_id", campaignId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (logsError) {
    return NextResponse.json({ error: logsError.message }, { status: 500 });
  }

  return NextResponse.json({
    campaign,
    recipients,
    logs: logs ?? [],
  });
}
