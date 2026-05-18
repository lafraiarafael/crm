"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordModal({ open, onOpenChange }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao enviar link de reset");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setEmail("");
      setLoading(false);
    } catch (err) {
      setError("Erro ao processar solicitação");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white shadow-lg">
        <DialogHeader className="border-b border-slate-200 pb-6">
          <DialogTitle className="text-2xl font-semibold text-slate-950">
            Recuperar Senha
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-8">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">
                <p className="font-medium">Email enviado com sucesso!</p>
                <p className="mt-2">
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                </p>
              </div>
              <Button
                onClick={() => {
                  setSuccess(false);
                  onOpenChange(false);
                }}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-white transition hover:bg-slate-800"
              >
                Voltar ao Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-sm leading-6 text-slate-600">
                Digite seu email e enviaremos um link para redefinir sua senha.
              </p>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  required
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
                  {loading ? "Enviando..." : "Enviar Link"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 transition hover:bg-slate-50"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
