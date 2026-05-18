import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2 } from "lucide-react";

function normalizeDisplayValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "null") {
    return null;
  }

  return trimmedValue;
}

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  created_at: string;
};

interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  selectedCustomerIds: string[];
  onToggleCustomerSelection: (customerId: string) => void;
  onToggleSelectAllCurrentPage: () => void;
  allCurrentPageSelected: boolean;
}

export function CustomerTable({
  customers,
  onEdit,
  selectedCustomerIds,
  onToggleCustomerSelection,
  onToggleSelectAllCurrentPage,
  allCurrentPageSelected,
}: CustomerTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              checked={allCurrentPageSelected && customers.length > 0}
              onChange={onToggleSelectAllCurrentPage}
              aria-label="Selecionar todos os clientes desta página"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
          </TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <input
                type="checkbox"
                checked={selectedCustomerIds.includes(customer.id)}
                onChange={() => onToggleCustomerSelection(customer.id)}
                aria-label={`Selecionar ${customer.full_name}`}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
            </TableCell>
            <TableCell className="font-medium text-slate-900">
              {customer.full_name}
            </TableCell>
            <TableCell className="text-slate-600">
              {normalizeDisplayValue(customer.email) ?? "—"}
            </TableCell>
            <TableCell>
              <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {normalizeDisplayValue(customer.phone) ?? "—"}
              </Badge>
            </TableCell>
            <TableCell>
              {normalizeDisplayValue(customer.source) ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {normalizeDisplayValue(customer.source) ?? "Manual"}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  Manual
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(customer)}
                title="Editar cliente"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableCaption>{`Exibindo ${customers.length} cliente(s) nesta página`}</TableCaption>
    </Table>
  );
}
