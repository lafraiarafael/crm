import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./auth.js";
import {
  getOrCreateSession,
  connectSession,
  sendMessage,
  logoutSession,
} from "./sessions.js";
import type { SendMessagePayload, StatusResponse, SendResponse } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3001);

// ── GET /health ───────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ── GET /sessions/:restaurantId/status ────────────────────────────────────────
app.get("/sessions/:restaurantId/status", requireAuth, (req, res) => {
  const { restaurantId } = req.params;
  const session = getOrCreateSession(restaurantId);

  const body: StatusResponse = {
    success: true,
    provider: "baileys",
    status: session.status,
    qrCode: session.qrCode,
    phoneNumber: session.phoneNumber,
    displayName: session.displayName,
    lastConnectedAt: session.lastConnectedAt?.toISOString() ?? null,
    lastError: session.lastError,
  };

  res.json(body);
});

// ── POST /sessions/:restaurantId/connect ──────────────────────────────────────
app.post("/sessions/:restaurantId/connect", requireAuth, async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const session = await connectSession(restaurantId);

    const body: StatusResponse = {
      success: true,
      provider: "baileys",
      status: session.status,
      qrCode: session.qrCode,
      phoneNumber: session.phoneNumber,
      displayName: session.displayName,
      lastConnectedAt: session.lastConnectedAt?.toISOString() ?? null,
    };

    res.json(body);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Erro ao conectar.",
    });
  }
});

// ── POST /sessions/:restaurantId/send ─────────────────────────────────────────
app.post("/sessions/:restaurantId/send", requireAuth, async (req, res) => {
  const { restaurantId } = req.params;
  const { phone, message } = req.body as SendMessagePayload;

  if (!phone || !message) {
    res.status(400).json({ success: false, error: "phone e message são obrigatórios." });
    return;
  }

  try {
    const externalId = await sendMessage(restaurantId, phone, message);
    const body: SendResponse = {
      success: true,
      provider: "baileys",
      externalId,
      status: "sent",
    };
    res.json(body);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Erro ao enviar mensagem.",
    });
  }
});

// ── POST /sessions/:restaurantId/logout ───────────────────────────────────────
app.post("/sessions/:restaurantId/logout", requireAuth, async (req, res) => {
  const { restaurantId } = req.params;

  try {
    await logoutSession(restaurantId);
    res.json({ success: true, provider: "baileys", status: "disconnected" });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Erro ao desconectar.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp server running on port ${PORT}`);
});
