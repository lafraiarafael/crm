type SessionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WhatsAppStatusResponse {
  success: boolean;
  provider: "baileys";
  status: SessionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  lastConnectedAt: string | null;
  lastError?: string | null;
}

export interface WhatsAppSendResponse {
  success: boolean;
  provider: "baileys";
  externalId: string;
  status: "sent";
}

function serverUrl(): string {
  const url = process.env.WHATSAPP_SERVER_URL;
  if (!url) throw new Error("WHATSAPP_SERVER_URL não configurada.");
  return url.replace(/\/$/, "");
}

function headers(): HeadersInit {
  const secret = process.env.WHATSAPP_SERVER_SECRET;
  if (!secret) throw new Error("WHATSAPP_SERVER_SECRET não configurada.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
}

export async function getWhatsAppStatus(restaurantId: string): Promise<WhatsAppStatusResponse> {
  const res = await fetch(`${serverUrl()}/sessions/${restaurantId}/status`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WhatsApp server error: ${res.status}`);
  return res.json() as Promise<WhatsAppStatusResponse>;
}

export async function connectWhatsApp(restaurantId: string): Promise<WhatsAppStatusResponse> {
  const res = await fetch(`${serverUrl()}/sessions/${restaurantId}/connect`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`WhatsApp server error: ${res.status}`);
  return res.json() as Promise<WhatsAppStatusResponse>;
}

export async function sendWhatsAppMessage({
  restaurantId,
  phone,
  message,
}: {
  restaurantId: string;
  phone: string;
  message: string;
}): Promise<WhatsAppSendResponse> {
  const res = await fetch(`${serverUrl()}/sessions/${restaurantId}/send`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `WhatsApp server error: ${res.status}`);
  }
  return res.json() as Promise<WhatsAppSendResponse>;
}

export async function logoutWhatsApp(restaurantId: string): Promise<void> {
  const res = await fetch(`${serverUrl()}/sessions/${restaurantId}/logout`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`WhatsApp server error: ${res.status}`);
}
