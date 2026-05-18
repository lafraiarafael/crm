"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    const token = searchParams.get("code");
    if (!token) {
      setError("Link de reset inválido. Solicite um novo link.");
      return;
    }
    setValidToken(true);
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError("Preencha todos os campos");
      return;
    }

    if (password !== confirmPassword) {
      setError("Senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const token = searchParams.get("code");
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao redefinir senha");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      setLoading(false);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError("Erro ao processar solicitação");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-slate-950">
      <Card className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
        <CardHeader className="border-b border-slate-200 px-8 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            CRM SaaS
          </p>
          <CardTitle className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Redefinir Senha
          </CardTitle>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Digite sua nova senha abaixo.
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-10 pt-8">
          {!validToken ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : success ? (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">
                <p className="font-medium">Senha redefinida com sucesso!</p>
                <p className="mt-2">Você será redirecionado para o login em alguns instantes.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                  Nova Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor="confirmPassword"
                >
                  Confirmar Senha
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-white transition hover:bg-slate-800"
                  disabled={loading}
                >
                  {loading ? "Atualizando..." : "Atualizar Senha"}
                </Button>
              </div>

              <Button
                type="button"
                variant="link"
                onClick={() => router.push("/login")}
                className="w-full text-slate-600 hover:text-slate-950"
              >
                Voltar ao Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
