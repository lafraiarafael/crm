import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_SOURCE_OPTIONS,
  normalizeCustomerName,
  normalizeCustomerPhone,
  normalizeCustomerSource,
} from "@/lib/customers";

const customerUpdateSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.enum(CUSTOMER_SOURCE_OPTIONS).optional().nullable(),
});

async function resolveRestaurantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", userId)
    .limit(1);

  const restaurantUser = data?.[0] ?? null;

  console.log("[customers-id-api] restaurant_users lookup", {
    userId,
    restaurantId: restaurantUser?.restaurant_id ?? null,
    queryError: error?.message ?? null,
  });

  if (error || !restaurantUser?.restaurant_id) {
    return null;
  }

  return restaurantUser.restaurant_id as string;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: customerId } = await params;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log("[customers-id-api] auth getUser (PUT)", {
    user: user ? { id: user.id, email: user.email } : null,
    authError: authError?.message ?? null,
    customerId,
  });

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const restaurantId = await resolveRestaurantId(supabase, user.id);

  if (!restaurantId) {
    return NextResponse.json(
      { error: "Restaurante não encontrado para o usuário." },
      { status: 403 }
    );
  }

  // Verificar se o cliente pertence ao restaurante do usuário
  const { data: existingCustomer, error: fetchError } = await supabase
    .from("customers")
    .select("id, restaurant_id")
    .eq("id", customerId)
    .eq("restaurant_id", restaurantId)
    .limit(1);

  const customerRow = existingCustomer?.[0] ?? null;

  console.log("[customers-id-api] fetch existing customer", {
    customerId,
    restaurantId,
    exists: !!customerRow,
    fetchError: fetchError?.message ?? null,
  });

  if (fetchError || !customerRow) {
    return NextResponse.json(
      { error: "Cliente não encontrado ou sem permissão de acesso." },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = customerUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos para cliente.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const normalizedName = normalizeCustomerName(parsed.data.full_name);
  const normalizedPhone = normalizeCustomerPhone(parsed.data.phone);

  if (normalizedName && normalizedPhone) {
    const { data: duplicateCustomers, error: duplicateError } = await supabase
      .from("customers")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("normalized_name", normalizedName)
      .eq("normalized_phone", normalizedPhone)
      .neq("id", customerId)
      .limit(1);

    const duplicateCustomer = duplicateCustomers?.[0] ?? null;

    if (duplicateError) {
      return NextResponse.json({ error: duplicateError.message }, { status: 500 });
    }

    if (duplicateCustomer) {
      return NextResponse.json({ error: "Cliente já cadastrado" }, { status: 409 });
    }
  }

  const updateRecord = {
    full_name: parsed.data.full_name.trim(),
    email: parsed.data.email?.trim() || null,
    phone: parsed.data.phone?.trim() || null,
    source: normalizeCustomerSource(parsed.data.source),
    normalized_name: normalizedName,
    normalized_phone: normalizedPhone,
  };

  const { data, error } = await supabase
    .from("customers")
    .update(updateRecord)
    .eq("id", customerId)
    .eq("restaurant_id", restaurantId)
    .select()
    .limit(1);

  const customer = data?.[0] ?? null;

  if (error || !customer) {
    return NextResponse.json(
      { error: error?.message ?? "Erro ao atualizar cliente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ customer }, { status: 200 });
}
