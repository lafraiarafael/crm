"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Users, AlertCircle, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    channel: "email" as "email" | "whatsapp",
    subject: "",
    message: "",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/customers")
      .then(r => r.json())
      .then(d => setCustomers(d.customers ?? []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, []);

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    if (!q) return true;
    if (form.channel === "email") return !!c.email && (c.full_name.toLowerCase().includes(q) || (c.email ?? "").includes(q));
    if (form.channel === "whatsapp") return !!c.phone && (c.full_name.toLowerCase().includes(q) || (c.phone ?? "").includes(q));
    return true;
  });

  const eligible = form.channel === "email"
    ? customers.filter(c => !!c.email)
    : customers.filter(c => !!c.phone);

  function toggleAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (selectedIds.size === 0) { setError("Selecione pelo menos 1 cliente."); return; }
    if (form.channel === "email" && !form.subject.trim()) { setError("Assunto é obrigatório para campanhas de email."); return; }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          channel: form.channel,
          message: form.message.trim(),
          subject: form.channel === "email" ? form.subject.trim() : null,
          customer_ids: [...selectedIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/dashboard/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <Link href="/dashboard/campaigns" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-950 transition mb-3">
          <ChevronLeft className="h-4 w-4" /> Voltar para campanhas
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Nova campanha</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Criar campanha</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Configure o canal, a mensagem e os destinatários.</p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
          <CardHeader><CardTitle className="text-base font-semibold text-slate-950">Canal de envio</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["email", "whatsapp"] as const).map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => { setForm(f => ({ ...f, channel: ch })); setSelectedIds(new Set()); }}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                    form.channel === ch
                      ? "border-slate-900 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {ch === "email" ? <Mail className="h-5 w-5 shrink-0" /> : <MessageCircle className="h-5 w-5 shrink-0" />}
                  <div>
                    <p className="font-semibold capitalize">{ch === "email" ? "Email" : "WhatsApp"}</p>
                    <p className={`text-xs ${form.channel === ch ? "text-slate-300" : "text-slate-500"}`}>
                      {ch === "email" ? `${eligible.length} clientes com email` : `${eligible.length} clientes com telefone`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
          <CardHeader><CardTitle className="text-base font-semibold text-slate-950">Mensagem</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nome da campanha</label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required placeholder="Ex: Promoção de aniversário" className="h-11 rounded-2xl" />
            </div>
            {form.channel === "email" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Assunto do email</label>
                <Input value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} required placeholder="Ex: Oferta especial para você!" className="h-11 rounded-2xl" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Mensagem</label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({...f, message: e.target.value}))}
                required
                rows={5}
                placeholder={form.channel === "email" ? "Escreva o conteúdo do email..." : `Escreva a mensagem do WhatsApp...

Use {nome} para personalizar.`}
                className="flex w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
              />
              <p className="text-xs text-slate-500">Use {"{nome}"} para inserir o nome do cliente automaticamente.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-950 flex items-center gap-2">
                <Users className="h-4 w-4" /> Destinatários
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{selectedIds.size} selecionados</span>
              </CardTitle>
              <button type="button" onClick={toggleAll} className="text-sm font-medium text-slate-600 hover:text-slate-950 transition">
                {selectedIds.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 rounded-2xl"
            />
            {loadingCustomers ? (
              <p className="py-4 text-center text-sm text-slate-500">Carregando clientes...</p>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                {form.channel === "email" ? "Nenhum cliente com email cadastrado." : "Nenhum cliente com telefone cadastrado."}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {filtered.map(c => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                        setSelectedIds(next);
                      }}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-950">{c.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{form.channel === "email" ? c.email : c.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={creating || selectedIds.size === 0} className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
            {creating ? "Criando..." : `Criar campanha para ${selectedIds.size} cliente${selectedIds.size !== 1 ? "s" : ""}`}
          </Button>
          <Link href="/dashboard/campaigns">
            <Button type="button" variant="outline" className="rounded-2xl">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
