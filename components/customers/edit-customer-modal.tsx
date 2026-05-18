"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CUSTOMER_SOURCE_OPTIONS } from "@/lib/customers";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  created_at: string;
};

interface EditCustomerModalProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export function EditCustomerModal({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: EditCustomerModalProps) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    source: "",
  });

  useEffect(() => {
    if (customer) {
      setForm({
        full_name: customer.full_name,
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        source: customer.source ?? "Manual",
      });
      setError(null);
      setSuccess(null);
    }
  }, [customer, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;

    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const body = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        source: form.source.trim() || null,
      };

      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atualizar cliente.");
      }

      setSuccess("Cliente atualizado com sucesso.");
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
      await onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar cliente. Tente novamente."
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-h-[90vh] max-w-2xl gap-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-xl shadow-slate-200/60">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-5 py-5 sm:px-6 sm:py-6">
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            Atualize os dados do cliente conforme necessário.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2.5 text-sm font-medium text-slate-700">
                <span>Nome completo</span>
                <Input
                  required
                  value={form.full_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      full_name: event.target.value,
                    }))
                  }
                  className="h-11"
                />
              </label>
              <label className="space-y-2.5 text-sm font-medium text-slate-700">
                <span>Email</span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="h-11"
                />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2.5 text-sm font-medium text-slate-700">
                <span>Telefone</span>
                <Input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="h-11"
                />
              </label>

              <label className="space-y-2.5 text-sm font-medium text-slate-700">
                <span>Origem</span>
                <select
                  value={form.source}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      source: event.target.value,
                    }))
                  }
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecionar origem</option>
                  {CUSTOMER_SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              </div>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{success}</span>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 rounded-b-3xl border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updating}>
              {updating ? "Atualizando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
