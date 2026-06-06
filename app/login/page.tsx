"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ForgotPasswordModal } from "@/components/auth/forgot-password-modal";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-slate-950">
      <Card className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
        <CardHeader className="border-b border-slate-200 px-8 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            CRM SaaS
          </p>
          <CardTitle className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Entrar
          </CardTitle>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Gerencie clientes, campanhas e seu fluxo comercial em um painel limpo e leve.
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-10 pt-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="button"
                onClick={() => setForgotPasswordOpen(true)}
                className="text-xs text-slate-600 hover:text-slate-950 transition"
              >
                Esqueci a senha?
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-white transition hover:bg-slate-800"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <p className="text-center text-sm text-slate-600">
              Ainda não tem conta?{" "}
              <Link
                href="/register"
                className="font-medium text-slate-950 underline-offset-4 hover:underline"
              >
                Criar conta grátis
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>

      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
      />
    </main>
  );
}

