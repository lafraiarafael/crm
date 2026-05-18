"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { CUSTOMER_SOURCE_OPTIONS } from "@/lib/customers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";

const MAX_PREVIEW_ROWS = 5;
const CSV_CANDIDATE_ENCODINGS = ["utf-8", "windows-1252", "iso-8859-1"] as const;

type PreviewRow = Record<string, string>;
type ColumnMapping = {
  full_name: string;
  email: string;
  phone: string;
};
type ParsedImportCustomer = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};
type ImportResult = {
  totalRows: number;
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  correctedPhones: number;
  invalidEmailsConverted: number;
  errors: string[];
  examples: string[];
};

function formatImportApiError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Erro ao importar clientes.";
  }

  const typedPayload = payload as {
    error?: unknown;
    details?: unknown;
  };

  if (typeof typedPayload.error === "string" && typedPayload.details) {
    const details =
      typeof typedPayload.details === "string"
        ? typedPayload.details
        : JSON.stringify(typedPayload.details);

    return `${typedPayload.error} ${details}`;
  }

  if (typeof typedPayload.error === "string") {
    return typedPayload.error;
  }

  return JSON.stringify(payload);
}

interface ImportCustomersModalProps {
  onSuccess?: () => Promise<void> | void;
}

function isValidImportFile(file: File) {
  const fileName = file.name.toLowerCase();
  return fileName.endsWith(".csv") || fileName.endsWith(".xlsx");
}

function formatCellValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

function scoreDecodedCsvText(text: string, encoding: (typeof CSV_CANDIDATE_ENCODINGS)[number]) {
  const replacementChars = text.match(/�/g)?.length ?? 0;
  const mojibakeMarkers = text.match(/Ã.|Â.|â.|ðŸ|ï»¿/g)?.length ?? 0;
  const portugueseChars = text.match(/[ãõáàâéêíóôõúçÃÕÁÀÂÉÊÍÓÔÕÚÇ]/g)?.length ?? 0;
  const emptyPenalty = text.trim().length === 0 ? 1000 : 0;
  const utf8Bonus = encoding === "utf-8" && text.charCodeAt(0) === 0xfeff ? -5 : 0;

  return replacementChars * 100 + mojibakeMarkers * 25 + emptyPenalty - portugueseChars + utf8Bonus;
}

function decodeCsvBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const candidates = CSV_CANDIDATE_ENCODINGS.map((encoding) => {
    const text = new TextDecoder(encoding).decode(bytes);

    return {
      encoding,
      text,
      score: scoreDecodedCsvText(text, encoding),
    };
  }).sort((left, right) => left.score - right.score);

  return candidates[0]?.text.replace(/^\uFEFF/, "") ?? "";
}

function readWorkbook(file: File, buffer: ArrayBuffer) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    const decodedCsv = decodeCsvBuffer(buffer);
    return XLSX.read(decodedCsv, {
      type: "string",
      raw: true,
    });
  }

  return XLSX.read(buffer, { type: "array" });
}

export function ImportCustomersModal({ onSuccess }: ImportCustomersModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [parsedRows, setParsedRows] = useState<PreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [shouldRefreshOnClose, setShouldRefreshOnClose] = useState(false);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    full_name: "",
    email: "",
    phone: "",
  });

  const resetPreview = () => {
    setDetectedHeaders([]);
    setPreviewRows([]);
    setParsedRows([]);
    setTotalRows(0);
    setImportResult(null);
    setShouldRefreshOnClose(false);
    setColumnMapping({
      full_name: "",
      email: "",
      phone: "",
    });
  };

  const canImport =
    !isParsing &&
    !isImporting &&
    !!file &&
    !!selectedSource &&
    !!columnMapping.full_name &&
    (!!columnMapping.phone || !!columnMapping.email) &&
    parsedRows.length > 0;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setImportResult(null);

    if (!selectedFile) {
      resetPreview();
      return;
    }

    if (!isValidImportFile(selectedFile)) {
      resetPreview();
      setFile(null);
      setError("Arquivo inválido. Envie um arquivo .csv ou .xlsx.");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setIsParsing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = readWorkbook(selectedFile, buffer);
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("Arquivo vazio. Não foi possível encontrar planilhas para importar.");
      }

      const firstSheet = workbook.Sheets[firstSheetName];
      const sheetRows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(firstSheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      const nonEmptyRows = sheetRows.filter((row) =>
        row.some((cell) => String(cell ?? "").trim() !== "")
      );

      if (nonEmptyRows.length === 0) {
        throw new Error("Arquivo vazio. Adicione dados para visualizar o preview.");
      }

      const rawHeaders = nonEmptyRows[0].map((cell, index) => {
        const value = String(cell ?? "").trim();
        return value || `Coluna ${index + 1}`;
      });

      const dataRows = nonEmptyRows.slice(1);

      if (dataRows.length === 0) {
        throw new Error("Arquivo vazio. Não encontramos linhas de dados após o cabeçalho.");
      }

      const normalizedPreviewRows = dataRows.slice(0, MAX_PREVIEW_ROWS).map((row) => {
        return rawHeaders.reduce<PreviewRow>((accumulator, header, index) => {
          accumulator[header] = formatCellValue(row[index]);
          return accumulator;
        }, {});
      });

      const normalizedRows = dataRows.map((row) => {
        return rawHeaders.reduce<PreviewRow>((accumulator, header, index) => {
          accumulator[header] = formatCellValue(row[index]);
          return accumulator;
        }, {});
      });

      setDetectedHeaders(rawHeaders);
      setPreviewRows(normalizedPreviewRows);
      setParsedRows(normalizedRows);
      setTotalRows(dataRows.length);
    } catch (parseError) {
      resetPreview();
      setFile(null);
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Não foi possível ler o arquivo selecionado."
      );
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      if (shouldRefreshOnClose) {
        await onSuccess?.();
      }

      setSelectedSource("");
      setFile(null);
      setError(null);
      setSuccess(null);
      resetPreview();
      setIsParsing(false);
      setIsImporting(false);
      setShouldRefreshOnClose(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setImportResult(null);

    if (!file) {
      setError("Selecione um arquivo .csv ou .xlsx para importar.");
      return;
    }

    if (!selectedSource) {
      setError("Selecione a origem dos clientes antes de importar.");
      return;
    }

    if (!columnMapping.full_name) {
      setError("Selecione a coluna correspondente ao nome completo.");
      return;
    }

    if (!columnMapping.phone && !columnMapping.email) {
      setError("Selecione a coluna correspondente ao telefone ou ao email.");
      return;
    }

    if (parsedRows.length === 0) {
      setError("Nenhuma linha válida foi encontrada para importar.");
      return;
    }

    const customers = parsedRows.reduce<ParsedImportCustomer[]>((accumulator, row) => {
      const fullName = row[columnMapping.full_name]?.trim() || null;
      const phone = row[columnMapping.phone]?.trim() || null;
      const email = columnMapping.email ? row[columnMapping.email]?.trim() || null : null;

      if (!fullName || (!phone && !email)) {
        return accumulator;
      }

      accumulator.push({
        full_name: fullName,
        email,
        phone,
      });

      return accumulator;
    }, []);

    if (customers.length === 0) {
      setError("Nenhum cliente válido encontrado para importar.");
      return;
    }

    const payload = {
      source: selectedSource,
      mapping: {
        full_name: columnMapping.full_name,
        email: columnMapping.email || null,
        phone: columnMapping.phone || null,
      },
      customers,
    };

    console.log("Import payload:", payload);

    setIsImporting(true);

    try {
      const response = await fetch("/api/customers/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await response.json();

      if (!response.ok) {
        console.error("Import API error:", responsePayload);
        setError(formatImportApiError(responsePayload));
        setIsImporting(false);
        return;
      }

      const result = {
        totalRows: responsePayload.totalRows ?? customers.length,
        imported: responsePayload.imported ?? 0,
        skippedDuplicates: responsePayload.skippedDuplicates ?? 0,
        skippedInvalid: responsePayload.skippedInvalid ?? 0,
        correctedPhones: responsePayload.correctedPhones ?? 0,
        invalidEmailsConverted: responsePayload.invalidEmailsConverted ?? 0,
        errors: Array.isArray(responsePayload.errors) ? responsePayload.errors : [],
        examples: Array.isArray(responsePayload.examples) ? responsePayload.examples : [],
      } satisfies ImportResult;

      setImportResult(result);

      if (result.imported === 0) {
        setSuccess("Nenhum cliente novo foi importado. Todos já existiam ou estavam inválidos.");
      } else {
        setSuccess(`${result.imported} clientes importados com sucesso.`);
      }

      setShouldRefreshOnClose(result.imported > 0);
    } catch (importError) {
      console.error("[customers-import-modal] import error", importError);
      setError(
        importError instanceof Error
          ? importError.message
          : "Erro ao importar clientes."
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="inline-flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Importar clientes
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-xl shadow-slate-200/60">
        <DialogHeader className="shrink-0 border-b border-slate-100 px-5 py-5 sm:px-6 sm:py-6">
          <DialogTitle>Importar clientes em lote</DialogTitle>
          <DialogDescription>
            Envie um arquivo e defina a origem que será aplicada a todos os clientes deste lote.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Arquivo de importação</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    Aceitamos arquivos .csv e .xlsx para a próxima etapa do importador.
                  </p>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Selecionar arquivo
                </Button>
                <p className="text-sm leading-6 text-slate-600 break-words">
                  {file ? file.name : "Nenhum arquivo selecionado"}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="block text-sm font-medium text-slate-700">
                Origem dos clientes
              </label>
              <select
                value={selectedSource}
                onChange={(event) => {
                  setSelectedSource(event.target.value);
                  setError(null);
                  setSuccess(null);
                }}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Selecionar origem</option>
                {CUSTOMER_SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className="text-sm leading-6 text-slate-500">
                Esta origem será aplicada a todos os clientes importados neste lote.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <p className="text-sm font-semibold text-slate-900">Mapeamento de colunas</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                Escolha quais colunas da planilha correspondem aos campos do CRM.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2.5 sm:col-span-2">
                  <span className="block text-sm font-medium text-slate-700">Nome completo</span>
                  <select
                    value={columnMapping.full_name}
                    onChange={(event) => {
                      setColumnMapping((current) => ({
                        ...current,
                        full_name: event.target.value,
                      }));
                      setError(null);
                      setSuccess(null);
                    }}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Selecionar coluna</option>
                    {detectedHeaders.map((header) => (
                      <option key={`full-name-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2.5">
                  <span className="block text-sm font-medium text-slate-700">Telefone</span>
                  <select
                    value={columnMapping.phone}
                    onChange={(event) => {
                      setColumnMapping((current) => ({
                        ...current,
                        phone: event.target.value,
                      }));
                      setError(null);
                      setSuccess(null);
                    }}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Selecionar coluna</option>
                    {detectedHeaders.map((header) => (
                      <option key={`phone-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2.5">
                  <span className="block text-sm font-medium text-slate-700">Email</span>
                  <select
                    value={columnMapping.email}
                    onChange={(event) => {
                      setColumnMapping((current) => ({
                        ...current,
                        email: event.target.value,
                      }));
                      setError(null);
                      setSuccess(null);
                    }}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Não mapear</option>
                    {detectedHeaders.map((header) => (
                      <option key={`email-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <p className="text-sm font-semibold text-slate-900">Preview inicial</p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm leading-6 text-slate-700 break-words">
                  Arquivo: {file?.name ?? "nenhum arquivo"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Origem selecionada: {selectedSource || "não definida"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Total de linhas encontradas: {totalRows}
                </p>
              </div>

              {isParsing ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  Lendo arquivo e preparando preview...
                </div>
              ) : detectedHeaders.length > 0 && previewRows.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 font-medium whitespace-nowrap">
                          Nome completo
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 font-medium whitespace-nowrap">
                          Telefone
                        </th>
                        {columnMapping.email ? (
                          <th className="border-b border-slate-200 px-4 py-3 font-medium whitespace-nowrap">
                            Email
                          </th>
                        ) : null}
                        <th className="border-b border-slate-200 px-4 py-3 font-medium whitespace-nowrap">
                          Origem
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={`${rowIndex}-${detectedHeaders.join("-")}`} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-4 py-3 align-top text-slate-700">
                            {columnMapping.full_name ? row[columnMapping.full_name] || "-" : "Selecione a coluna"}
                          </td>
                          <td className="px-4 py-3 align-top text-slate-700">
                            {columnMapping.phone ? row[columnMapping.phone] || "-" : "Selecione a coluna"}
                          </td>
                          {columnMapping.email ? (
                            <td className="px-4 py-3 align-top text-slate-700">
                              {row[columnMapping.email] || "-"}
                            </td>
                          ) : null}
                          <td className="px-4 py-3 align-top text-slate-700">
                            {selectedSource || "não definida"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm leading-6 text-slate-500">
                  Selecione um arquivo válido para visualizar as primeiras 5 linhas da planilha.
                </div>
              )}
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
                {importResult ? (
                  <div className="mt-3 space-y-1 text-sm">
                    <p>{`${importResult.totalRows} linhas lidas`}</p>
                    <p>{`${importResult.imported} clientes importados`}</p>
                    <p>{`${importResult.skippedDuplicates} clientes ignorados por duplicidade`}</p>
                    <p>{`${importResult.skippedInvalid} clientes ignorados por dados inválidos`}</p>
                    <p>{`${importResult.correctedPhones} telefones corrigidos com nono dígito`}</p>
                    <p>{`${importResult.invalidEmailsConverted} emails inválidos convertidos para vazio`}</p>
                    {importResult.errors.length > 0 ? (
                      <p>{`${importResult.errors.length} erros encontrados no processamento`}</p>
                    ) : null}
                    {importResult.examples.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-emerald-200/70 bg-white/70 p-3 text-slate-700">
                        <p className="font-medium text-slate-900">Exemplos do processamento</p>
                        <ul className="mt-2 space-y-1">
                          {importResult.examples.map((example, index) => (
                            <li key={`${index}-${example}`}>{example}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-3xl border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void handleOpenChange(false);
              }}
              className="w-full sm:w-auto"
              disabled={isImporting}
            >
              Fechar
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!canImport}>
              {isImporting ? "Importando..." : "Processar importação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}