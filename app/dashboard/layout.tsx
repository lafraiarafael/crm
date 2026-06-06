import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Buscar restaurante do usuário
  const { data: restaurantUser } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const restaurantName =
    (restaurantUser?.restaurants as { name?: string } | null)?.name ?? "Meu Restaurante";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-200 bg-white/95 px-4 py-6 lg:block">
        <Sidebar restaurantName={restaurantName} />
      </div>
      <div className="flex min-h-screen flex-col lg:pl-72">
        <Topbar userEmail={user.email ?? ""} restaurantName={restaurantName} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

