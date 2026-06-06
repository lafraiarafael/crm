"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Store, Mail, Phone, Link as LinkIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default function SettingsPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    loadRestaurant();
  }, []);

  async function loadRestaurant() {
    setLoading(true);
    try {
      const res = await fetch("/api/restaurants");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRestaurant(data.restaurant);
      setForm({
        name: data.restaurant.name ?? "",
        email: data.restaurant.email ?? "",
        phone: data.restaurant.phone ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRestaurant(data.restaurant);
      setSuccess("Configurações salvas com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Configurações</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Perfil do restaurante</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Atualize o nome, email e telefone do seu restaurante.
        </p>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando configurações...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">Dados do restaurante</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700" htmlFor="name">
                    <Store className="h-4 w-4 text-slate-400" />
                    Nome do restaurante
                  </label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700" htmlFor="email">
                    <Mail className="h-4 w-4 text-slate-400" />
                    Email de contato
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contato@seurestaurante.com"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className="h-11 rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700" htmlFor="phone">
                    <Phone className="h-4 w-4 text-slate-400" />
                    Telefone
                  </label>
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="h-11 rounded-2xl"
                  />
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <Button type="submit" disabled={saving} className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-950">Informações da conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">ID do restaurante</p>
                  <p className="mt-2 break-all font-mono text-xs text-slate-700">{restaurant?.id}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" /> Slug
                  </p>
                  <p className="mt-2 font-mono text-sm text-slate-700">{restaurant?.slug}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Criado em</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {restaurant?.created_at
                      ? new Date(restaurant.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
                      : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

