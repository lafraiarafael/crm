import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 text-slate-950">
      <main className="w-full max-w-4xl rounded-[2rem] border border-slate-200 bg-white px-8 py-12 shadow-lg shadow-slate-200/40">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              CRM SaaS leve
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Gerencie clientes e campanhas com foco em produtividade.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Um painel moderno e limpo para administrar seu restaurante com clareza e facilidade.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-3xl bg-slate-50 px-5 py-4 shadow-sm shadow-slate-200/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <span className="font-semibold">CP</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">Curry Pasta CRM</p>
              <p className="text-sm text-slate-500">Identidade leve e profissional</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-950">Visão geral rápida</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Métricas, clientes e campanhas em um painel objetivo e fácil de navegar.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-950">Fluxo centrado em produto</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Interface clean para uso diário, mantendo foco em dados importantes e organização.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
