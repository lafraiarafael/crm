import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_SOURCE_OPTIONS,
  formatCustomerName,
  normalizeBrazilianMobilePhoneWithMeta,
  normalizeEmailWithMeta,
  normalizeCustomerName,
  normalizeCustomerSource,
} from "@/lib/customers";

const customerImportSchema = z.object({
  source: z.enum(CUSTOMER_SOURCE_OPTIONS),
  mapping: z
    .object({
      full_name: z.string(),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    })
    .optional(),
  customers: z.array(
    z.object({
      full_name: z.string(),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    })
  ).min(1),
});

type PreparedCustomer = {
  restaurant_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string;
  normalized_name: string;
  normalized_phone: string;
};

const MAX_IMPORT_EXAMPLES = 10;

function pushImportExample(examples: string[], message: string) {
  if (examples.length < MAX_IMPORT_EXAMPLES) {
    examples.push(message);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado.", details: null }, { status: 401 });
    }

    const { data: restaurantUser, error: restaurantError } = await supabase
      .from("restaurant_users")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (restaurantError || !restaurantUser?.restaurant_id) {
      return NextResponse.json(
        {
          error: "Restaurante não encontrado para o usuário.",
          details: restaurantError?.message ?? null,
        },
        { status: 400 }
      );
    }

    const restaurantId = restaurantUser.restaurant_id as string;
    const body = await request.json();
    const parsed = customerImportSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[customers-import-api] invalid payload", parsed.error.flatten());
      return NextResponse.json(
        {
          error: "Dados inválidos para importação.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(parsed.data.customers) || parsed.data.customers.length === 0) {
      return NextResponse.json(
        {
          error: "Dados inválidos para importação.",
          details: "customers deve ser um array com pelo menos um item.",
        },
        { status: 400 }
      );
    }

    const source = normalizeCustomerSource(parsed.data.source);
    const totalRows = parsed.data.customers.length;

    if (!source) {
      return NextResponse.json(
        {
          error: "Origem do lote inválida.",
          details: null,
        },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    const examples: string[] = [];
    const preparedCustomers: PreparedCustomer[] = [];
    const batchSeenKeys = new Set<string>();
    let skippedDuplicates = 0;
    let skippedInvalid = 0;
    let correctedPhones = 0;
    let invalidEmailsConverted = 0;

    parsed.data.customers.forEach((customer, index) => {
      const fullName = formatCustomerName(customer.full_name);
      const phoneResult = normalizeBrazilianMobilePhoneWithMeta(customer.phone);
      const emailResult = normalizeEmailWithMeta(customer.email);
      const normalizedPhone = phoneResult.normalized;
      const normalizedEmail = emailResult.normalized;
      const normalizedName = normalizeCustomerName(fullName);
      const lineNumber = index + 2;

      if (!fullName) {
        errors.push(`Linha ${lineNumber}: nome completo ausente.`);
        pushImportExample(examples, `Linha ${lineNumber}: nome ausente.`);
        skippedInvalid += 1;
        return;
      }

      if (!normalizedPhone) {
        errors.push(`Linha ${lineNumber}: telefone ausente ou inválido.`);
        pushImportExample(examples, `Linha ${lineNumber}: telefone inválido.`);
        skippedInvalid += 1;
        return;
      }

      if (phoneResult.wasCorrected) {
        correctedPhones += 1;
      }

      if (emailResult.wasInvalidConverted) {
        invalidEmailsConverted += 1;
        pushImportExample(examples, `Linha ${lineNumber}: email inválido convertido para vazio.`);
      }

      const dedupeKey = `${normalizedName}|${normalizedPhone}`;

      if (batchSeenKeys.has(dedupeKey)) {
        skippedDuplicates += 1;
        pushImportExample(examples, `Linha ${lineNumber}: cliente duplicado no arquivo.`);
        return;
      }

      batchSeenKeys.add(dedupeKey);
      preparedCustomers.push({
        restaurant_id: restaurantId,
        full_name: fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        source,
        normalized_name: normalizedName,
        normalized_phone: normalizedPhone,
      });
    });

    if (preparedCustomers.length === 0) {
      return NextResponse.json(
        {
          totalRows,
          imported: 0,
          skippedDuplicates,
          skippedInvalid,
          correctedPhones,
          invalidEmailsConverted,
          errors,
          examples,
        },
        { status: 200 }
      );
    }

    const { data: existingCustomers, error: existingCustomersError } = await supabase
      .from("customers")
      .select("normalized_name, normalized_phone")
      .eq("restaurant_id", restaurantId);

    if (existingCustomersError) {
      console.error("[customers-import-api] duplicate lookup error", existingCustomersError);
      return NextResponse.json(
        { error: "Erro ao verificar duplicados.", details: existingCustomersError.message },
        { status: 500 }
      );
    }

    const existingKeys = new Set(
      (existingCustomers ?? []).map(
        (customer) => `${customer.normalized_name}|${customer.normalized_phone}`
      )
    );

    const customersToInsert = preparedCustomers.filter((customer) => {
      const dedupeKey = `${customer.normalized_name}|${customer.normalized_phone}`;
      const shouldInsert = !existingKeys.has(dedupeKey);

      if (!shouldInsert) {
        skippedDuplicates += 1;
        pushImportExample(examples, `Cliente duplicado já existente no banco: ${customer.full_name}.`);
      }

      return shouldInsert;
    });

    if (customersToInsert.length === 0) {
      return NextResponse.json(
        {
          totalRows,
          imported: 0,
          skippedDuplicates,
          skippedInvalid,
          correctedPhones,
          invalidEmailsConverted,
          errors,
          examples,
        },
        { status: 200 }
      );
    }

    for (let index = 0; index < customersToInsert.length; index += 100) {
      const chunk = customersToInsert.slice(index, index + 100);
      const { error: insertError } = await supabase.from("customers").insert(chunk);

      if (insertError) {
        console.error("[customers-import-api] insert error", insertError);
        return NextResponse.json(
          { error: "Erro ao inserir clientes.", details: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        totalRows,
        imported: customersToInsert.length,
        skippedDuplicates,
        skippedInvalid,
        correctedPhones,
        invalidEmailsConverted,
        errors,
        examples,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[customers-import] unexpected error", error);

    return NextResponse.json(
      {
        error: "Erro interno ao importar clientes.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}