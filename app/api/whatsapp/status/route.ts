import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWhatsAppStatus } from "@/lib/whatsapp";

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

  try {
    // Chamar servidor Baileys real (se WHATSAPP_SERVER_URL estiver configurada)
    const serverStatus = await getWhatsAppStatus(restaurantId);

    // Sincronizar estado no Supabase para persistência
    await supabase
      .from("whatsapp_sessions")
      .upsert(
        {
          restaurant_id: restaurantId,
          provider: "baileys",
          status: serverStatus.status,
          phone_number: serverStatus.phoneNumber,
          display_name: serverStatus.displayName,
          qr_code: serverStatus.qrCode,
          last_error: serverStatus.lastError ?? null,
          last_connected_at: serverStatus.lastConnectedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "restaurant_id,provider" }
      );

    // Buscar sessão salva para retornar formato consistente
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
      .eq("restaurant_id", restaurantId)
      .eq("provider", "baileys")
      .single();

    return NextResponse.json({ session, serverStatus });
  } catch (err) {
    // Servidor não disponível — retornar dados do Supabase como fallback
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
      .eq("restaurant_id", restaurantId)
      .eq("provider", "baileys")
      .maybeSingle();

    if (!session) {
      const { data: newSession } = await supabase
        .from("whatsapp_sessions")
        .insert({ restaurant_id: restaurantId, provider: "baileys", status: "disconnected" })
        .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
        .single();
      return NextResponse.json({
        session: newSession,
        warning: err instanceof Error ? err.message : "Servidor WhatsApp não disponível.",
      });
    }

    return NextResponse.json({
      session,
      warning: err instanceof Error ? err.message : "Servidor WhatsApp não disponível.",
    });
  }
}
