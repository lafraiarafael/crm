import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logoutWhatsApp } from "@/lib/whatsapp";

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
    await logoutWhatsApp(restaurantId);
  } catch {
    // ignorar erros do servidor — mesmo assim limpar o Supabase
  }

  await supabase
    .from("whatsapp_sessions")
    .update({
      status: "disconnected",
      qr_code: null,
      phone_number: null,
      display_name: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId)
    .eq("provider", "baileys");

  return NextResponse.json({ success: true, status: "disconnected" });
}
