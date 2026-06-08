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

export const maxDuration = 25;

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

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serverSecret}`,
  };

  // Verificar sessão atual no Supabase
  const { data: existing } = await supabase
    .from("whatsapp_sessions")
    .select("status, qr_code")
    .eq("restaurant_id", restaurantId)
    .eq("provider", "baileys")
    .maybeSingle();

  // Se já está connecting com QR — não recriar, só retornar o QR atual
  if (existing?.status === "connecting" && existing?.qr_code) {
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
      .eq("restaurant_id", restaurantId)
      .eq("provider", "baileys")
      .single();
    return NextResponse.json({ session });
  }

  // Se já está connected — não fazer nada
  if (existing?.status === "connected") {
    const { data: session } = await supabase
      .from("whatsapp_sessions")
      .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
      .eq("restaurant_id", restaurantId)
      .eq("provider", "baileys")
      .single();
    return NextResponse.json({ session });
  }

  // Chamar /connect no Railway para iniciar nova sessão
  try {
    await fetch(`${serverUrl}/sessions/${encodeURIComponent(restaurantId)}/connect`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Continuar mesmo se falhou
  }

  // Marcar como connecting
  await supabase
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
    );

  // Polling com até 20s esperando o QR aparecer
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, attempt === 0 ? 3000 : 2500));

    try {
      const res = await fetch(
        `${serverUrl}/sessions/${encodeURIComponent(restaurantId)}/status`,
        { headers: { Authorization: `Bearer ${serverSecret}` }, signal: AbortSignal.timeout(5000) }
      );

      if (!res.ok) continue;

      const serverStatus = await res.json() as {
        status: string;
        qrCode: string | null;
        phoneNumber: string | null;
        displayName: string | null;
        lastConnectedAt: string | null;
        lastError?: string | null;
      };

      const { data: session } = await supabase
        .from("whatsapp_sessions")
        .update({
          status: serverStatus.status,
          qr_code: serverStatus.qrCode,
          phone_number: serverStatus.phoneNumber,
          display_name: serverStatus.displayName,
          last_error: serverStatus.lastError ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("restaurant_id", restaurantId)
        .eq("provider", "baileys")
        .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
        .single();

      if (serverStatus.qrCode || serverStatus.status === "connected") {
        return NextResponse.json({ session });
      }
    } catch {
      // Tentar novamente
    }
  }

  const { data: session } = await supabase
    .from("whatsapp_sessions")
    .select("id, restaurant_id, provider, status, phone_number, display_name, qr_code, last_error, last_connected_at, updated_at")
    .eq("restaurant_id", restaurantId)
    .eq("provider", "baileys")
    .single();

  return NextResponse.json({ session });
}
