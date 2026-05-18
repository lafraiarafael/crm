import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Users, MessageCircle, Mail, Store } from "lucide-react";
import { DashboardStatCard } from "@/components/dashboard/stat-card";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  const totalCustomers = customers?.length || 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              CRM de restaurante
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Visão geral do painel
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Controle clientes, campanhas e performance com um fluxo mais limpo e focado em produto.
            </p>
          </div>

          <Badge className="w-fit rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            Conectado
          </Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <DashboardStatCard
          title="Clientes"
          value={totalCustomers}
          description="contatos cadastrados"
          icon={<Users className="h-5 w-5 text-slate-500" />}
        />

        <DashboardStatCard
          title="WhatsApp"
          value="Ativo"
          description="módulo planejado"
          icon={<MessageCircle className="h-5 w-5 text-slate-500" />}
        />

        <DashboardStatCard
          title="Email"
          value="Pronto"
          description="módulo planejado"
          icon={<Mail className="h-5 w-5 text-slate-500" />}
        />

        <DashboardStatCard
          title="Restaurante"
          value="Curry Pasta"
          description="conta piloto"
          icon={<Store className="h-5 w-5 text-slate-500" />}
        />
      </section>

      <section>
        <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-950">Clientes recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-200">
              {customers?.map((customer) => (
                <div
                  key={customer.id}
                  className="flex flex-col gap-4 border-b border-slate-200 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{customer.full_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{customer.email || "Sem email"}</p>
                  </div>

                  <Badge variant="secondary" className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                    {customer.phone || "Sem telefone"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
