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

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const restaurantId = await getRestaurantId(supabase, user.id);

  if (!restaurantId) {
    return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });
  }

  const { data: existingSession, error: sessionError } = await supabase
    .from("whatsapp_sessions")
    .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
    .eq("restaurant_id", restaurantId)
    .eq("provider", "baileys")
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (existingSession) {
    return NextResponse.json({ session: existingSession });
  }

  const { data: newSession, error: createError } = await supabase
    .from("whatsapp_sessions")
    .insert({
      restaurant_id: restaurantId,
      provider: "baileys",
      status: "disconnected",
    })
    .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
    .single();

  if (createError || !newSession) {
    return NextResponse.json({ error: createError?.message ?? "Erro ao criar sessão." }, { status: 500 });
  }

  return NextResponse.json({ session: newSession });
}
