import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error || !data?.restaurant_id) return null;
  return data.restaurant_id as string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const restaurantId = await getRestaurantId(supabase, user.id);
  if (!restaurantId) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, email, phone, created_at")
    .eq("id", restaurantId)
    .single();

  if (error || !restaurant) return NextResponse.json({ error: error?.message ?? "Restaurante não encontrado." }, { status: 404 });
  return NextResponse.json({ restaurant });
}

const updateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres.").optional(),
  email: z.string().email("Email inválido.").nullable().optional(),
  phone: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const restaurantId = await getRestaurantId(supabase, user.id);
  if (!restaurantId) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 403 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .update(updates)
    .eq("id", restaurantId)
    .select("id, name, slug, email, phone, created_at")
    .single();

  if (error || !restaurant) return NextResponse.json({ error: error?.message ?? "Erro ao atualizar." }, { status: 500 });
  return NextResponse.json({ restaurant });
}

