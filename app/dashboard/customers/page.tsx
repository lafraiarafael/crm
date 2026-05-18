"use client"

import { useEffect, useMemo, useState } from "react";
import { CUSTOMER_SOURCE_OPTIONS } from "@/lib/customers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertCircle, Inbox, Search } from "lucide-react";
import { CustomerTable } from "@/components/customers/customer-table";
import { AddCustomerModal } from "@/components/customers/add-customer-modal";
import { EditCustomerModal } from "@/components/customers/edit-customer-modal";
import { ImportCustomersModal } from "@/components/customers/import-customers-modal";
import { Button } from "@/components/ui/button";

const CUSTOMERS_PER_PAGE = 25;

const QUICK_FILTER_CATEGORIES = {
  ALL: "Todos",
  WHATSAPP_VALID: "Com WhatsApp válido",
  EMAIL_VALID: "Com Email válido",
  NO_EMAIL: "Sem Email",
  SISTEMA_RESERVAS: "Sistema de Reservas",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  DELIVERY: "Delivery",
  EVENTO: "Evento",
} as const;

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  created_at: string;
};

type QuickFilterKey = keyof typeof QUICK_FILTER_CATEGORIES;

function normalizeCustomerSearchValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const trimmedValue = value.trim();
  return trimmedValue.toLowerCase() === "null" ? "" : trimmedValue.toLowerCase();
}

function matchesQuickFilter(customer: Customer, filter: QuickFilterKey): boolean {
  const normalizedSource = normalizeCustomerSearchValue(customer.source);

  switch (filter) {
    case "ALL":
      return true;

    case "WHATSAPP_VALID":
      return !!customer.phone && customer.phone.length >= 10;

    case "EMAIL_VALID":
      return !!customer.email && customer.email.includes("@");

    case "NO_EMAIL":
      return !customer.email || !customer.email.includes("@");

    case "SISTEMA_RESERVAS":
      return normalizedSource === "sistema de reservas";

    case "INSTAGRAM":
      return normalizedSource === "instagram";

    case "WHATSAPP":
      return normalizedSource === "whatsapp";

    case "DELIVERY":
      return normalizedSource === "delivery";

    case "EVENTO":
      return normalizedSource === "evento";

    default:
      return true;
  }
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedSource, setSelectedSource] = useState("Todas");
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<QuickFilterKey>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState<string | null>(null);

  const quickFilterCounts = useMemo(() => {
    if (!customers) {
      return Object.keys(QUICK_FILTER_CATEGORIES).reduce((acc, key) => {
        acc[key as QuickFilterKey] = 0;
        return acc;
      }, {} as Record<QuickFilterKey, number>);
    }

    return (Object.keys(QUICK_FILTER_CATEGORIES) as QuickFilterKey[]).reduce(
      (acc, key) => {
        acc[key] = customers.filter((c) => matchesQuickFilter(c, key)).length;
        return acc;
      },
      {} as Record<QuickFilterKey, number>
    );
  }, [customers]);

  useEffect(() => {
    void loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || "Não foi possível carregar os clientes.");
      }

      const data = await response.json();
      setCustomers(data.customers ?? []);
      setSelectedCustomerIds((current) =>
        current.filter((customerId) => (data.customers ?? []).some((customer: Customer) => customer.id === customerId))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os clientes."
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const query = search.trim().toLowerCase();
    const normalizedSelectedSource = selectedSource.toLowerCase();

    return customers.filter((customer) => {
      const name = customer.full_name.toLowerCase();
      const email = normalizeCustomerSearchValue(customer.email);
      const source = normalizeCustomerSearchValue(customer.source);

      const matchesSearch =
        !query ||
        name.includes(query) ||
        email.includes(query) ||
        source.includes(query);

      const matchesSource =
        selectedSource === "Todas" || source === normalizedSelectedSource;

      const matchesQuickFilt = matchesQuickFilter(customer, selectedQuickFilter);

      return matchesSearch && matchesSource && matchesQuickFilt;
    });
  }, [customers, search, selectedSource, selectedQuickFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE));

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(startIndex, startIndex + CUSTOMERS_PER_PAGE);
  }, [currentPage, filteredCustomers]);

  const paginationRange = useMemo(() => {
    if (filteredCustomers.length === 0) {
      return { start: 0, end: 0 };
    }

    const start = (currentPage - 1) * CUSTOMERS_PER_PAGE + 1;
    const end = Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length);

    return { start, end };
  }, [currentPage, filteredCustomers.length]);

  const allCurrentPageSelected = useMemo(() => {
    if (paginatedCustomers.length === 0) {
      return false;
    }

    return paginatedCustomers.every((customer) => selectedCustomerIds.includes(customer.id));
  }, [paginatedCustomers, selectedCustomerIds]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedCustomerIds([]);
    setSelectAllFiltered(false);
  }, [search, selectedSource, selectedQuickFilter]);

  useEffect(() => {
    setCampaignMessage(null);
  }, [search, selectedSource, selectedQuickFilter, currentPage]);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditModalOpen(true);
  };

  const handleEditSuccess = async () => {
    await loadCustomers();
    setEditingCustomer(null);
  };

  const handleToggleCustomerSelection = (customerId: string) => {
    setSelectedCustomerIds((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId]
    );
  };

  const handleToggleSelectAllCurrentPage = () => {
    const currentPageIds = paginatedCustomers.map((customer) => customer.id);

    setSelectedCustomerIds((current) => {
      const shouldClearCurrentPage = currentPageIds.every((id) => current.includes(id));

      if (shouldClearCurrentPage) {
        return current.filter((id) => !currentPageIds.includes(id));
      }

      const next = new Set([...current, ...currentPageIds]);
      return [...next];
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectAllFiltered(true);
    setSelectedCustomerIds(filteredCustomers.map((c) => c.id));
  };

  const handleClearAllFiltered = () => {
    setSelectAllFiltered(false);
    setSelectedCustomerIds([]);
  };

  const handleCreateCampaign = () => {
    if (selectedCustomerIds.length === 0) {
      return;
    }

    setCampaignMessage(
      `Placeholder: criar campanha para ${selectedCustomerIds.length} cliente(s) selecionado(s).`
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Gestão de Clientes
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              CRM de clientes
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Veja, busque e adicione clientes do restaurante com segurança e visibilidade em tempo real.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
            <div className="relative w-full xl:min-w-[320px] xl:flex-1 xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou email"
                className="pl-9"
              />
            </div>

            <div className="w-full xl:w-auto xl:min-w-[220px]">
              <select
                value={selectedSource}
                onChange={(event) => setSelectedSource(event.target.value)}
                className="flex h-10 w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-4 py-2 pr-11 text-sm text-slate-900 shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Filtrar por origem"
              >
                <option value="Todas">Todas</option>
                {CUSTOMER_SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:flex-none">
              <ImportCustomersModal onSuccess={loadCustomers} />
              <AddCustomerModal onSuccess={loadCustomers} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <p className="mb-4 text-sm font-semibold text-slate-700">Filtros rápidos</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(QUICK_FILTER_CATEGORIES) as QuickFilterKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedQuickFilter(key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                selectedQuickFilter === key
                  ? "border border-slate-300 bg-slate-900 text-white shadow-md"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
              }`}
            >
              <span>{QUICK_FILTER_CATEGORIES[key]}</span>
              <span className={`text-xs font-semibold ${
                selectedQuickFilter === key
                  ? "text-slate-300"
                  : "text-slate-500"
              }`}>
                ({quickFilterCounts[key]})
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
          <CardHeader>
            <CardTitle>Clientes cadastrados</CardTitle>
            <CardDescription className="mt-2 text-sm text-slate-500">
              A lista a seguir mostra os clientes vinculados ao restaurante atual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && !error && filteredCustomers.length > 0 && !selectAllFiltered ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  {filteredCustomers.length} {filteredCustomers.length === 1 ? "cliente" : "clientes"} corresponde{filteredCustomers.length === 1 ? "" : "m"} ao filtro
                </p>
                <button
                  onClick={handleSelectAllFiltered}
                  className="text-sm font-medium text-slate-900 hover:text-slate-700 transition underline"
                >
                  Selecionar todos os {filteredCustomers.length} clientes deste filtro
                </button>
              </div>
            ) : null}

            {!loading && !error && selectAllFiltered ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-white">
                  {selectedCustomerIds.length} {selectedCustomerIds.length === 1 ? "cliente" : "clientes"} selecionado{selectedCustomerIds.length === 1 ? "" : "s"} neste filtro
                </p>
                <button
                  onClick={handleClearAllFiltered}
                  className="text-sm font-medium text-slate-300 hover:text-white transition"
                >
                  Limpar seleção
                </button>
              </div>
            ) : null}

            {!loading && !error && selectedCustomerIds.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {selectedCustomerIds.length} {selectedCustomerIds.length === 1 ? "cliente" : "clientes"} selecionado{selectedCustomerIds.length === 1 ? "" : "s"}
                </p>
                <Button
                  type="button"
                  onClick={handleCreateCampaign}
                  disabled={selectedCustomerIds.length === 0}
                >
                  Criar campanha
                </Button>
              </div>
            ) : null}

            {campaignMessage ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {campaignMessage}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Carregando clientes...
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center text-sm text-rose-700">
                {error}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Inbox className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-900">Nenhum cliente encontrado.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Crie o primeiro cliente ou ajuste sua busca.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <CustomerTable
                  customers={paginatedCustomers}
                  onEdit={handleEditCustomer}
                  selectedCustomerIds={selectedCustomerIds}
                  onToggleCustomerSelection={handleToggleCustomerSelection}
                  onToggleSelectAllCurrentPage={handleToggleSelectAllCurrentPage}
                  allCurrentPageSelected={allCurrentPageSelected}
                />
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    {`Mostrando ${paginationRange.start}–${paginationRange.end} de ${filteredCustomers.length} clientes`}
                  </p>
                  <div className="flex gap-2 self-end sm:self-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 shadow-sm shadow-slate-200/50">
          <CardHeader>
            <CardTitle>Visão rápida</CardTitle>
            <CardDescription className="mt-2 text-sm text-slate-500">
              Use filtros rápidos e mantenha seus clientes organizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Total de clientes
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">
                {customers?.length ?? 0}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Filtro ativo
              </p>
              <p className="mt-3 text-sm text-slate-700">
                {search && selectedSource !== "Todas"
                  ? `Busca por "${search}" em ${selectedSource}`
                  : search
                    ? `Busca por "${search}"`
                    : selectedSource !== "Todas"
                      ? `Origem: ${selectedSource}`
                      : "Nenhum filtro aplicado"}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Próxima ação
              </p>
              <p className="mt-3 text-sm text-slate-700">
                Clique em "Novo Cliente" para adicionar um contato ao restaurante.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <EditCustomerModal
        customer={editingCustomer}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
