import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
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

    // 1. Criar usuário via signUp normal (compatível com novas chaves Supabase)
    const supabase = await createServerClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already registered")) {
        return NextResponse.json(
          { error: "Este email já está cadastrado." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Erro ao criar usuário." },
        { status: 500 }
      );
    }

    // 2. Usar service client apenas para operações de DB (sem auth admin)
    //    Bypassa RLS para inserir restaurante e vínculo
    const serviceClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const baseSlug = generateSlug(restaurantName);
    const uniqueSlug = `${baseSlug}-${userId.slice(0, 8)}`;

    // 3. Criar restaurante
    const { data: restaurant, error: restaurantError } = await serviceClient
      .from("restaurants")
      .insert({ name: restaurantName, slug: uniqueSlug })
      .select()
      .single();

    if (restaurantError || !restaurant) {
      // Tentar limpar usuário criado
      await serviceClient.auth.admin.deleteUser(userId).catch(() => null);
      return NextResponse.json(
        { error: "Erro ao criar restaurante." },
        { status: 500 }
      );
    }

    // 4. Vincular usuário como owner
    const { error: linkError } = await serviceClient
      .from("restaurant_users")
      .insert({
        restaurant_id: restaurant.id,
        user_id: userId,
        role: "owner",
      });

    if (linkError) {
      await serviceClient.from("restaurants").delete().eq("id", restaurant.id);
      await serviceClient.auth.admin.deleteUser(userId).catch(() => null);
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

