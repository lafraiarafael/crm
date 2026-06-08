import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import type { WhatsAppSession } from "./types.js";

const SESSION_DIR = process.env.SESSION_DIR ?? path.join(process.cwd(), "sessions");
const sessions = new Map<string, WhatsAppSession>();

function sessionPath(restaurantId: string): string {
  return path.join(SESSION_DIR, restaurantId);
}

export function getSession(restaurantId: string): WhatsAppSession | undefined {
  return sessions.get(restaurantId);
}

export function getOrCreateSession(restaurantId: string): WhatsAppSession {
  if (!sessions.has(restaurantId)) {
    sessions.set(restaurantId, {
      restaurantId,
      status: "disconnected",
      qrCode: null,
      phoneNumber: null,
      displayName: null,
      lastError: null,
      lastConnectedAt: null,
      socket: null,
    });
  }
  return sessions.get(restaurantId)!;
}

function setStatus(restaurantId: string, patch: Partial<WhatsAppSession>): void {
  const s = getOrCreateSession(restaurantId);
  Object.assign(s, patch);
}

export async function connectSession(restaurantId: string): Promise<WhatsAppSession> {
  const existing = sessions.get(restaurantId);
  if (existing?.status === "connected") return existing;

  setStatus(restaurantId, { status: "connecting", qrCode: null, lastError: null });

  try {
    const authDir = sessionPath(restaurantId);
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // Buscar versão com fallback — evita falha de rede no Railway
    let version: [number, number, number] = [2, 3000, 1015901307];
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
    } catch {
      console.warn("[baileys] fetchLatestBaileysVersion falhou — usando versão padrão");
    }

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      logger: {
        level: "warn",
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: (msg: unknown) => console.warn("[baileys]", msg),
        error: (msg: unknown) => console.error("[baileys]", msg),
        fatal: (msg: unknown) => console.error("[baileys] fatal", msg),
        child: () => ({
          trace: () => {}, debug: () => {}, info: () => {},
          warn: (m: unknown) => console.warn("[baileys]", m),
          error: (m: unknown) => console.error("[baileys]", m),
          fatal: (m: unknown) => console.error("[baileys]", m),
          child: () => ({} as never),
        }),
      } as never,
      browser: ["CRM", "Chrome", "1.0.0"],
    });

    setStatus(restaurantId, { socket: sock });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[baileys] QR gerado para ${restaurantId}`);
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          setStatus(restaurantId, { qrCode: qrDataUrl, status: "connecting" });
        } catch (err) {
          console.error("[baileys] Erro ao gerar QR Data URL:", err);
          setStatus(restaurantId, { qrCode: null });
        }
      }

      if (connection === "open") {
        const info = sock.user;
        console.log(`[baileys] Conectado: ${restaurantId} — ${info?.id}`);
        setStatus(restaurantId, {
          status: "connected",
          qrCode: null,
          phoneNumber: info?.id?.split(":")[0] ?? null,
          displayName: info?.name ?? null,
          lastConnectedAt: new Date(),
          lastError: null,
        });
      }

      if (connection === "close") {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        console.log(`[baileys] Conexão fechada: ${restaurantId} — reason: ${reason} — reconectar: ${shouldReconnect}`);

        if (shouldReconnect) {
          setStatus(restaurantId, { status: "connecting", socket: null });
          setTimeout(() => connectSession(restaurantId), 3000);
        } else {
          setStatus(restaurantId, {
            status: "disconnected",
            socket: null,
            qrCode: null,
            phoneNumber: null,
            displayName: null,
          });
        }
      }
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[baileys] Erro ao conectar ${restaurantId}:`, msg);
    setStatus(restaurantId, { status: "error", lastError: msg, socket: null });
  }

  return sessions.get(restaurantId)!;
}

export async function sendMessage(
  restaurantId: string,
  phone: string,
  message: string
): Promise<string> {
  const session = sessions.get(restaurantId);
  if (!session || session.status !== "connected" || !session.socket) {
    throw new Error("Session not connected.");
  }

  const sock = session.socket as ReturnType<typeof makeWASocket>;
  const normalized = phone.replace(/\D/g, "");
  const jid = normalized.includes("@") ? normalized : `${normalized}@s.whatsapp.net`;

  const delay = 2000 + Math.random() * 3000;
  await new Promise((r) => setTimeout(r, delay));

  const result = await sock.sendMessage(jid, { text: message });
  return result?.key?.id ?? crypto.randomUUID();
}

export async function logoutSession(restaurantId: string): Promise<void> {
  const session = sessions.get(restaurantId);
  if (session?.socket) {
    try {
      await (session.socket as ReturnType<typeof makeWASocket>).logout();
    } catch {
      // ignorar erros no logout
    }
  }

  const authDir = sessionPath(restaurantId);
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
  }

  sessions.set(restaurantId, {
    restaurantId,
    status: "disconnected",
    qrCode: null,
    phoneNumber: null,
    displayName: null,
    lastError: null,
    lastConnectedAt: null,
    socket: null,
  });
}
