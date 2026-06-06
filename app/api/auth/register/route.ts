import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const registerSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres."),
  restaurantName: z.string().min(2, "Nome do restaurante deve ter pelo menos 2 caracteres."),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? "Dados inválidos." },
        { status: 400 }
      );
    }

    const { email, password, restaurantName } = parsed.data;

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.toLowerCase().includes("already registered")) {
        return NextResponse.json(
          { error: "Este email já está cadastrado." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Gerar slug único
    const baseSlug = generateSlug(restaurantName);
    const uniqueSlug = `${baseSlug}-${userId.slice(0, 8)}`;

    // 3. Criar restaurante
    const { data: restaurant, error: restaurantError } = await adminClient
      .from("restaurants")
      .insert({ name: restaurantName, slug: uniqueSlug })
      .select()
      .single();

    if (restaurantError || !restaurant) {
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Erro ao criar restaurante." },
        { status: 500 }
      );
    }

    // 4. Vincular usuário como owner
    const { error: linkError } = await adminClient
      .from("restaurant_users")
      .insert({
        restaurant_id: restaurant.id,
        user_id: userId,
        role: "owner",
      });

    if (linkError) {
      await adminClient.from("restaurants").delete().eq("id", restaurant.id);
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Erro ao vincular usuário ao restaurante." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Conta criada com sucesso." },
      { status: 201 }
    );
  } catch (err) {
    console.error("[register-api] unexpected error", err);
    return NextResponse.json(
      { error: "Erro interno ao criar conta." },
      { status: 500 }
    );
  }
}

