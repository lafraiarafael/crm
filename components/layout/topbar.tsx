import { Sparkle, Circle } from "lucide-react";

interface TopbarProps {
  userEmail: string;
}

export function Topbar({ userEmail }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-xl px-4 py-4 shadow-sm shadow-slate-200/50 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Visão geral</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Painel principal
          </h2>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 text-emerald-500" />
            <span className="text-slate-600">Conectado</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-slate-950 shadow-sm shadow-slate-200/60">
            <Sparkle className="h-4 w-4 text-emerald-500" />
            <span>{userEmail}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
