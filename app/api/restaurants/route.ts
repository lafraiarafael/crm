import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { data: restaurantUser, error: restaurantUserError } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (restaurantUserError || !restaurantUser?.restaurant_id) {
    return NextResponse.json(
      { error: "Restaurante não encontrado para o usuário." },
      { status: 403 }
    );
  }

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, email, phone, created_at")
    .eq("id", restaurantUser.restaurant_id)
    .single();

  if (error || !restaurant) {
    return NextResponse.json(
      { error: error?.message ?? "Restaurante não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ restaurant });
}

