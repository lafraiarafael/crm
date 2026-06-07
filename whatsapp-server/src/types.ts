export type SessionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WhatsAppSession {
  restaurantId: string;
  status: SessionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  lastError: string | null;
  lastConnectedAt: Date | null;
  socket: unknown | null;
}

export interface SendMessagePayload {
  phone: string;
  message: string;
}

export interface StatusResponse {
  success: boolean;
  provider: "baileys";
  status: SessionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  lastConnectedAt: string | null;
  lastError?: string | null;
}

export interface SendResponse {
  success: boolean;
  provider: "baileys";
  externalId: string;
  status: "sent";
}
