import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { connectWhatsApp } from "@/lib/whatsapp";

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

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const restaurantId = await getRestaurantId(supabase, user.id);
  if (!restaurantId) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });

  try {
    const serverStatus = await connectWhatsApp(restaurantId);

    // Sincronizar no Supabase
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .upsert(
        {
          restaurant_id: restaurantId,
          provider: "baileys",
          status: serverStatus.status,
          qr_code: serverStatus.qrCode,
          phone_number: serverStatus.phoneNumber,
          display_name: serverStatus.displayName,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "restaurant_id,provider" }
      )
      .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
      .single();

    return NextResponse.json({ session, serverStatus });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao iniciar conexão WhatsApp." },
      { status: 503 }
    );
  }
}
