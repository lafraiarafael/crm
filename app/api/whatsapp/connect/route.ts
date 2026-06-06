import { NextResponse } from "next/server";
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

function buildMockQrCode(restaurantId: string) {
  return `whatsapp://connect?restaurant=${restaurantId}&session=mock-baileys`;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const restaurantId = await getRestaurantId(supabase, user.id);

  if (!restaurantId) {
    return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });
  }

  const sessionPayload = {
    restaurant_id: restaurantId,
    provider: "baileys",
    status: "connecting",
    qr_code: buildMockQrCode(restaurantId),
    server_session_id: `mock_${restaurantId}`,
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  const { data: session, error } = await supabase
    .from("whatsapp_sessions")
    .upsert(sessionPayload, { onConflict: "restaurant_id,provider" })
    .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
    .single();

  if (error || !session) {
    return NextResponse.json({ error: error?.message ?? "Erro ao iniciar conexão." }, { status: 500 });
  }

  return NextResponse.json({ session });
}
