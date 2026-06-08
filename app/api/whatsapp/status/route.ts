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
  if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const restaurantId = await getRestaurantId(supabase, user.id);
  if (!restaurantId) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });

  const serverUrl = process.env.WHATSAPP_SERVER_URL;
  const serverSecret = process.env.WHATSAPP_SERVER_SECRET;

  // Buscar sessão salva no Supabase
  let { data: session } = await supabase
    .from("whatsapp_sessions")
    .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
    .eq("restaurant_id", restaurantId)
    .eq("provider", "baileys")
    .maybeSingle();

  // Criar sessão se não existir
  if (!session) {
    const { data: newSession } = await supabase
      .from("whatsapp_sessions")
      .insert({ restaurant_id: restaurantId, provider: "baileys", status: "disconnected" })
      .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
      .single();
    session = newSession;
  }

  // Se não há servidor configurado, retornar apenas dados do Supabase
  if (!serverUrl || !serverSecret) {
    return NextResponse.json({ session, warning: "Servidor WhatsApp não configurado." });
  }

  // Se está connecting ou connected, buscar status atualizado do Railway
  if (session?.status === "connecting" || session?.status === "connected") {
    try {
      const res = await fetch(
        `${serverUrl}/sessions/${encodeURIComponent(restaurantId)}/status`,
        {
          headers: { Authorization: `Bearer ${serverSecret}` },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (res.ok) {
        const serverStatus = await res.json() as {
          status: string;
          qrCode: string | null;
          phoneNumber: string | null;
          displayName: string | null;
          lastConnectedAt: string | null;
          lastError?: string | null;
        };

        // Sincronizar no Supabase
        const { data: updated } = await supabase
          .from("whatsapp_sessions")
          .update({
            status: serverStatus.status,
            qr_code: serverStatus.qrCode,
            phone_number: serverStatus.phoneNumber,
            display_name: serverStatus.displayName,
            last_error: serverStatus.lastError ?? null,
            last_connected_at: serverStatus.lastConnectedAt ?? session?.last_connected_at,
            updated_at: new Date().toISOString(),
          })
          .eq("restaurant_id", restaurantId)
          .eq("provider", "baileys")
          .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
          .single();

        return NextResponse.json({ session: updated ?? session });
      }
    } catch {
      // Railway não respondeu — retornar dados do Supabase como fallback
    }
  }

  return NextResponse.json({ session });
}
