"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle, CheckCircle2, Clock, MessageCircle,
  QrCode, RefreshCw, Smartphone, LogOut, Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SessionStatus = "disconnected" | "connecting" | "connected" | "error";

type WhatsAppSession = {
  id: string;
  restaurant_id: string;
  provider: string;
  status: SessionStatus;
  phone_number: string | null;
  display_name: string | null;
  qr_code: string | null;
  last_error: string | null;
  last_connected_at: string | null;
  updated_at: string | null;
};

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; icon: React.ElementType }> = {
  disconnected: { label: "Desconectado", color: "bg-slate-100 text-slate-700", icon: Smartphone },
  connecting:   { label: "Aguardando QR Code", color: "bg-amber-100 text-amber-800", icon: Clock },
  connected:    { label: "Conectado", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  error:        { label: "Erro", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function WhatsAppPage() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading]       = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [warning, setWarning]       = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res  = await fetch("/api/whatsapp/status");
      const data = await res.json() as { session?: WhatsAppSession; warning?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar.");
      setSession(data.session ?? null);
      if (data.warning) setWarning(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Polling automático quando status é "connecting" (aguardando QR / conexão)
  useEffect(() => {
    if (session?.status !== "connecting") return;
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, [session?.status, loadStatus]);

  async function connect() {
    setConnecting(true);
    setError(null);
    setWarning(null);
    try {
      const res  = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json() as { session?: WhatsAppSession; warning?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao conectar.");
      setSession(data.session ?? null);
      if (data.warning) setWarning(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar conexão.");
    } finally {
      setConnecting(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setError(null);
    try {
      await fetch("/api/whatsapp/logout", { method: "POST" });
      await loadStatus();
    } catch {
      setError("Erro ao desconectar.");
    } finally {
      setLoggingOut(false);
    }
  }

  const status       = session?.status ?? "disconnected";
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;
  const StatusIcon   = statusConfig.icon;

  // QR code real: pode ser data URL ou string raw
  const qrSrc = session?.qr_code?.startsWith("data:")
    ? session.qr_code
    : session?.qr_code
    ? `data:image/png;base64,${session.qr_code}`
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">WhatsApp</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Conexão WhatsApp</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Conecte seu WhatsApp escaneando o QR Code abaixo. A conexão é por restaurante e persiste enquanto o servidor estiver ativo.
            </p>
          </div>
          <Badge className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusConfig.color}`}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {warning && !error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <Wifi className="h-4 w-4 shrink-0" />
          <span>Servidor WhatsApp offline — exibindo dados salvos. {warning}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-950 flex items-center gap-2">
              <QrCode className="h-4 w-4" /> QR Code de conexão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Carregando sessão...
              </div>
            ) : status === "connected" ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
                <p className="mt-4 font-semibold text-emerald-900">WhatsApp conectado</p>
                <p className="mt-2 text-sm text-emerald-700">
                  {session?.display_name ?? session?.phone_number ?? "Sessão ativa"}
                </p>
              </div>
            ) : qrSrc ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="mb-4 text-sm font-medium text-slate-700">
                  Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo
                </p>
                <img
                  src={qrSrc}
                  alt="QR Code do WhatsApp"
                  className="mx-auto h-56 w-56 rounded-2xl border border-slate-200 bg-white p-2"
                />
                <p className="mt-4 text-xs text-slate-500">
                  O QR Code atualiza automaticamente a cada 4 segundos.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                <MessageCircle className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 font-semibold text-slate-900">Nenhuma sessão ativa</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Clique em conectar para gerar o QR Code do WhatsApp.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {status !== "connected" && (
                <Button onClick={connect} disabled={connecting} className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                  {connecting ? "Conectando..." : "Conectar WhatsApp"}
                </Button>
              )}
              {status === "connected" && (
                <Button onClick={logout} disabled={loggingOut} variant="destructive" className="rounded-2xl">
                  <LogOut className="mr-2 h-4 w-4" />
                  {loggingOut ? "Desconectando..." : "Desconectar"}
                </Button>
              )}
              <Button variant="outline" onClick={loadStatus} disabled={loading} className="rounded-2xl">
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">Status da sessão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Provider", value: session?.provider ?? "baileys" },
                { label: "Telefone",  value: session?.phone_number ?? "—" },
                { label: "Nome",      value: session?.display_name ?? "—" },
                { label: "Última conexão", value: formatDate(session?.last_connected_at ?? null) },
                { label: "Atualizado em",  value: formatDate(session?.updated_at ?? null) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
                </div>
              ))}
              {session?.last_error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-red-500">Último erro</p>
                  <p className="mt-2 text-sm font-medium text-red-700">{session.last_error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
