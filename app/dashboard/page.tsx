import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { Users, MessageCircle, Mail, Store } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  const totalCustomers = customers?.length || 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm border border-slate-200 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Restaurant CRM Platform
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              Curry Pasta CRM
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Manage customers, WhatsApp campaigns, email marketing and future
              reservation modules from one clean dashboard.
            </p>
          </div>

          <Badge className="w-fit rounded-full bg-emerald-600 px-4 py-1 text-white hover:bg-emerald-600">
            Online
          </Badge>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-500">
                Customers
              </CardTitle>
              <Users className="h-5 w-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{totalCustomers}</p>
              <p className="mt-1 text-sm text-slate-500">registered contacts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-500">
                WhatsApp
              </CardTitle>
              <MessageCircle className="h-5 w-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">Active</p>
              <p className="mt-1 text-sm text-slate-500">module planned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-500">
                Email
              </CardTitle>
              <Mail className="h-5 w-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">Ready</p>
              <p className="mt-1 text-sm text-slate-500">module planned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-500">
                Restaurant
              </CardTitle>
              <Store className="h-5 w-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">Curry Pasta</p>
              <p className="mt-1 text-sm text-slate-500">pilot account</p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Recent Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-200">
                {customers?.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-950">
                        {customer.full_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {customer.email || "No email"}
                      </p>
                    </div>

                    <Badge variant="secondary" className="w-fit">
                      {customer.phone || "No phone"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}