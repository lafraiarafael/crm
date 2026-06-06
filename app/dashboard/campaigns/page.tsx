"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Mail, MessageCircle, Clock, CheckCircle2, XCircle, FileText, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Campaign = {
  id: string;
  name: string;
  channel: "email" | "whatsapp";
  status: "draft" | "scheduled" | "sent" | "failed" | "paused";
  subject: string | null;
  created_at: string;
  sent_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_failed: number;
};

const STATUS_CONFIG = {
  draft: { label: "Rascunho", color: "bg-slate-100 text-slate-700", icon: FileText },
  scheduled: { label: "Agendada", color: "bg-amber-100 text-amber-800", icon: Clock },
  sent: { label: "Enviada", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700", icon: XCircle },
  paused: { label: "Pausada", color: "bg-slate-100 text-slate-600", icon: Clock },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCampaigns(data.campaigns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar campanhas.");
    } finally {
      setLoading(false);
    }
  }

  const stats = campaigns ? {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === "sent").length,
    draft: campaigns.filter(c => c.status === "draft").length,
    totalSent: campaigns.reduce((acc, c) => acc + (c.total_sent || 0), 0),
  } : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Marketing</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Campanhas</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Crie e gerencie campanhas de email e WhatsApp para seus clientes.
            </p>
          </div>
          <Link href="/dashboard/campaigns/new">
            <Button className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
              <Plus className="h-4 w-4" />
              Nova campanha
            </Button>
          </Link>
        </div>
      </section>

      {stats && (
        <section className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total", value: stats.total, sub: "campanhas" },
            { label: "Enviadas", value: stats.sent, sub: "concluídas" },
            { label: "Rascunhos", value: stats.draft, sub: "pendentes" },
            { label: "Msgs enviadas", value: stats.totalSent, sub: "mensagens" },
          ].map((s) => (
            <div key={s.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{s.value}</p>
              <p className="mt-1 text-xs text-slate-500">{s.sub}</p>
            </div>
          ))}
        </section>
      )}

      <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-950">Todas as campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Carregando campanhas...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Inbox className="h-5 w-5 text-slate-500" />
              </div>
              <p className="font-semibold text-slate-900">Nenhuma campanha ainda.</p>
              <p className="mt-1 text-sm text-slate-500">Crie sua primeira campanha de email ou WhatsApp.</p>
              <Link href="/dashboard/campaigns/new" className="mt-4 inline-block">
                <Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800 mt-4">
                  <Plus className="mr-2 h-4 w-4" /> Nova campanha
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {campaigns.map((campaign) => {
                const st = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
                const StatusIcon = st.icon;
                return (
                  <div key={campaign.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                        {campaign.channel === "email"
                          ? <Mail className="h-4 w-4 text-slate-500" />
                          : <MessageCircle className="h-4 w-4 text-slate-500" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-950">{campaign.name}</p>
                        {campaign.subject && <p className="text-sm text-slate-500">{campaign.subject}</p>}
                        <p className="mt-0.5 text-xs text-slate-400">
                          {new Date(campaign.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          {" · "}{campaign.total_recipients} destinatários
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {campaign.status === "sent" && (
                        <span className="text-xs text-slate-500">
                          {campaign.total_sent}/{campaign.total_recipients} enviados
                        </span>
                      )}
                      <Badge className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${st.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {st.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

