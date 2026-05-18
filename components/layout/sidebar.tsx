"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, MessageCircle, Phone, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Painel", icon: Home },
  { href: "/dashboard/customers", label: "Clientes", icon: Users },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: MessageCircle },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: Phone },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col justify-between overflow-hidden bg-white">
      <div className="space-y-10">
        <div>
          <div className="mb-10 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm shadow-slate-200/50">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm shadow-slate-900/20">
              <span className="text-lg font-semibold">CP</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Curry Pasta CRM</p>
              <p className="text-xs text-slate-500">Hub de controle empresarial</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-slate-100 text-slate-950 shadow-sm shadow-slate-200"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? "text-slate-900" : "text-slate-400")}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-medium text-slate-950">Mantenha a experiência fluida.</p>
          <p className="mt-2 leading-6">Um espaço CRM limpo para equipes de restaurantes e operações de crescimento.</p>
        </div>
      </div>
    </aside>
  );
}
