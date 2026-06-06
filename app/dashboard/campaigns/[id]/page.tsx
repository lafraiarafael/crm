"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  Mail,
  MessageCircle,
  MousePointerClick,
  Send,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Campaign = {
  id: string;
  name: string;
  channel: "email" | "whatsapp";
  status: "draft" | "scheduled" | "sent" | "failed" | "paused";
  subject: string | null;
  message: string;
  created_at: string;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_failed: number;
};

type Recipient = {
  id: string;
  customer_id: string;
  customer: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    source: string | null;
  } | null;
};

type MessageLog = {
  id: string;
  customer_id: string | null;
  channel: "email" | "whatsapp";
  status: "pending" | "sent" | "failed";
  provider: string | null;
  external_id: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  opened: boolean;
  clicked: boolean;
  clicked_url: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
};

type EmailEvent = {
  id: string;
  message_log_id: string | null;
  customer_id: string | null;
  event_type: string;
  event_status: string;
  recipient_email: string | null;
  clicked_url: string | null;
  occurred_at: string;
  created_at: string;
};

type Tracking = {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  complained: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
};

type CampaignDetailResponse = {
  campaign: Campaign;
  recipients: Recipient[];
  logs: MessageLog[];
  email_events: EmailEvent[];
  tracking: Tracking;
};

const STATUS_CONFIG = {
  draft: { label: "Rascunho", color: "bg-slate-100 text-slate-700", icon: FileText },
  scheduled: { label: "Agendada", color: "bg-amber-100 text-amber-800", icon: Clock },
  sent: { label: "Enviada", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700", icon: XCircle },
  paused: { label: "Pausada", color: "bg-slate-100 text-slate-600", icon: Clock },
};

const LOG_STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-800", icon: Clock },
  sent: { label: "Enviada", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700", icon: XCircle },
};

const EVENT_LABELS: Record<string, string> = {
  "email.sent": "Enviado",
  "email.delivered": "Entregue",
  "email.delivery_delayed": "Entrega atrasada",
  "email.opened": "Aberto",
  "email.clicked": "Clique",
  "email.bounced": "Bounce",
  "email.complained": "Reclamação",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value: number | undefined) {
  return `${value ?? 0}%`;
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  const [data, setData] = useState<CampaignDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    loadCampaign();
  }, [campaignId]);

  async function loadCampaign() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar campanha.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    if (!campaignId || sending) return;

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "POST" });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      setSendSuccess(`Envio concluído: ${json.total_sent ?? 0} enviados, ${json.total_failed ?? 0} falhas.`);
      await loadCampaign();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erro ao enviar campanha.");
    } finally {
      setSending(false);
    }
  }

  const campaign = data?.campaign ?? null;
  const recipients = data?.recipients ?? [];
  const logs = data?.logs ?? [];
  const emailEvents = data?.email_events ?? [];
  const tracking = data?.tracking ?? null;
  const status = campaign ? STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft : null;
  const StatusIcon = status?.icon ?? FileText;
  const canSendEmail = campaign?.channel === "email" && campaign.status !== "sent";

  const stats = campaign
    ? [
        { label: "Destinatários", value: campaign.total_recipients ?? recipients.length, icon: Users },
        { label: "Enviadas", value: campaign.total_sent ?? 0, icon: CheckCircle2 },
        { label: "Falhas", value: campaign.total_failed ?? 0, icon: XCircle },
        { label: "Eventos", value: emailEvents.length, icon: FileText },
      ]
    : [];

  const trackingCards = tracking
    ? [
        { label: "Entregues", value: tracking.delivered, sub: `${formatPercent(tracking.delivery_rate)} de entrega`, icon: CheckCircle2 },
        { label: "Abertos", value: tracking.opened, sub: `${formatPercent(tracking.open_rate)} de abertura`, icon: TrendingUp },
        { label: "Cliques", value: tracking.clicked, sub: `${formatPercent(tracking.click_rate)} de clique`, icon: MousePointerClick },
        { label: "Bounces", value: tracking.bounced + tracking.complained, sub: `${tracking.bounced} bounce / ${tracking.complained} reclamação`, icon: XCircle },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <Link href="/dashboard/campaigns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-950 transition mb-3">
          <ChevronLeft className="h-4 w-4" /> Voltar para campanhas
        </Link>

        {loading ? (
          <div className="mt-3 text-sm text-slate-500">Carregando campanha...</div>
        ) : error ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : campaign ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Campanha</p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{campaign.name}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Criada em {formatDate(campaign.created_at)}{campaign.sent_at ? ` · enviada em ${formatDate(campaign.sent_at)}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {campaign.channel === "email" ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                {campaign.channel === "email" ? "Email" : "WhatsApp"}
              </Badge>
              {status && (
                <Badge className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {campaign && (
        <>
          <section className="grid gap-4 sm:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
                    <Icon className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</p>
                </div>
              );
            })}
          </section>

          {campaign.channel === "email" && (
            <section className="grid gap-4 sm:grid-cols-4">
              {trackingCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-slate-950">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{stat.sub}</p>
                  </div>
                );
              })}
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-950">Mensagem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaign.subject && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Assunto</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{campaign.subject}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Conteúdo</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{campaign.message}</p>
                </div>

                {sendError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{sendError}</span>
                  </div>
                )}

                {sendSuccess && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{sendSuccess}</span>
                  </div>
                )}

                {campaign.channel === "email" ? (
                  <Button
                    type="button"
                    disabled={!canSendEmail || sending}
                    onClick={handleSendEmail}
                    className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {sending ? "Enviando..." : campaign.status === "sent" ? "Campanha já enviada" : "Enviar campanha por email"}
                  </Button>
                ) : (
                  <Button disabled className="rounded-2xl bg-slate-950 text-white opacity-60">
                    <Send className="mr-2 h-4 w-4" /> Envio por WhatsApp será conectado no próximo bloco
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-950">Destinatários</CardTitle>
              </CardHeader>
              <CardContent>
                {recipients.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Nenhum destinatário vinculado.</p>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200">
                    {recipients.map((recipient) => (
                      <div key={recipient.id} className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-950">{recipient.customer?.full_name ?? "Cliente removido"}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {campaign.channel === "email" ? recipient.customer?.email : recipient.customer?.phone}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">Eventos de email</CardTitle>
            </CardHeader>
            <CardContent>
              {emailEvents.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Nenhum evento recebido ainda. Depois do webhook da Resend, aberturas e cliques aparecerão aqui.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {emailEvents.map((event) => (
                    <div key={event.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-950">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{event.recipient_email ?? "—"} · {formatDate(event.occurred_at)}</p>
                        {event.clicked_url && <p className="mt-1 break-all text-xs text-slate-500">{event.clicked_url}</p>}
                      </div>
                      <Badge className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {event.event_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">Logs de envio</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Nenhum envio registrado ainda. Os logs aparecerão aqui depois da integração com Resend ou WhatsApp.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const logStatus = LOG_STATUS_CONFIG[log.status] ?? LOG_STATUS_CONFIG.pending;
                    const LogStatusIcon = logStatus.icon;

                    return (
                      <div key={log.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-950">{log.provider ?? log.channel}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Enviado: {formatDate(log.sent_at)} · Entregue: {formatDate(log.delivered_at)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Aberto: {formatDate(log.opened_at)} · Clique: {formatDate(log.clicked_at)}
                          </p>
                          {log.clicked_url && <p className="mt-1 break-all text-xs text-slate-500">{log.clicked_url}</p>}
                          {log.error_message && <p className="mt-1 text-xs text-red-600">{log.error_message}</p>}
                        </div>
                        <Badge className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${logStatus.color}`}>
                          <LogStatusIcon className="h-3 w-3" />
                          {logStatus.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
