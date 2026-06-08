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

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const restaurantId = await getRestaurantId(supabase, user.id);
  if (!restaurantId) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });

  const serverUrl = process.env.WHATSAPP_SERVER_URL;
  const serverSecret = process.env.WHATSAPP_SERVER_SECRET;

  if (!serverUrl || !serverSecret) {
    return NextResponse.json({ error: "Servidor WhatsApp não configurado." }, { status: 503 });
  }

  // Disparar conexão no Railway sem aguardar resposta completa (fire-and-forget)
  // O Railway vai processar em background e o /status vai buscar o QR via polling
  void fetch(
    `${serverUrl}/sessions/${encodeURIComponent(restaurantId)}/connect`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverSecret}`,
      },
    }
  ).catch(() => null); // ignorar erros — o status vai checar

  // Marcar como "connecting" no Supabase imediatamente
  const { data: session } = await supabase
    .from("whatsapp_sessions")
    .upsert(
      {
        restaurant_id: restaurantId,
        provider: "baileys",
        status: "connecting",
        qr_code: null,
        phone_number: null,
        display_name: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,provider" }
    )
    .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
    .single();

  // Aguardar 3 segundos para o Baileys ter tempo de gerar o primeiro QR
  await new Promise((r) => setTimeout(r, 3000));

  // Tentar buscar o QR do Railway
  try {
    const res = await fetch(
      `${serverUrl}/sessions/${encodeURIComponent(restaurantId)}/status`,
      {
        headers: { Authorization: `Bearer ${serverSecret}` },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (res.ok) {
      const serverStatus = await res.json() as {
        status: string;
        qrCode: string | null;
        phoneNumber: string | null;
        displayName: string | null;
        lastConnectedAt: string | null;
      };

      // Atualizar com QR se já disponível
      const { data: updated } = await supabase
        .from("whatsapp_sessions")
        .update({
          status: serverStatus.status,
          qr_code: serverStatus.qrCode,
          phone_number: serverStatus.phoneNumber,
          display_name: serverStatus.displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("restaurant_id", restaurantId)
        .eq("provider", "baileys")
        .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
        .single();

      return NextResponse.json({ session: updated ?? session });
    }
  } catch {
    // QR ainda não disponível — o polling vai buscar
  }

  return NextResponse.json({ session });
}
