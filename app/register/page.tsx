"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    restaurantName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (form.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      // 1. Chamar API que cria usuário + restaurante + vínculo
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          restaurantName: form.restaurantName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Erro ao criar conta.");
        setLoading(false);
        return;
      }

      // 2. Fazer login automático após registro
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (signInError) {
        // Conta criada mas login falhou — redirecionar para login manual
        setSuccess(true);
        setLoading(false);
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      // 3. Redirecionar para dashboard
      router.push("/dashboard");
    } catch {
      setError("Erro ao criar conta. Tente novamente.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-950">Conta criada!</h1>
          <p className="text-sm text-slate-600">Redirecionando para o login...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-slate-950">
      <Card className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
        <CardHeader className="border-b border-slate-200 px-8 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            CRM SaaS
          </p>
          <CardTitle className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Criar conta
          </CardTitle>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Configure seu restaurante e comece a gerenciar clientes e campanhas.
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-10 pt-8">
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="restaurantName">
                Nome do restaurante
              </label>
              <Input
                id="restaurantName"
                type="text"
                placeholder="Ex: Curry Pasta"
                value={form.restaurantName}
                onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))}
                required
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
                Confirmar senha
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a senha"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-white transition hover:bg-slate-800"
              disabled={loading}
            >
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>

            <p className="text-center text-sm text-slate-600">
              Já tem uma conta?{" "}
              <Link
                href="/login"
                className="font-medium text-slate-950 underline-offset-4 hover:underline"
              >
                Entrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

