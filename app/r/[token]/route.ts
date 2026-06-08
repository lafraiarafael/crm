import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Usar service client para registrar clique sem autenticação de usuário
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: link } = await supabase
    .from("tracked_links")
    .select("id, original_url, click_count, first_clicked_at, message_log_id")
    .eq("token", token)
    .single();

  if (!link) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL!));
  }

  const now = new Date().toISOString();

  // Registrar clique
  await supabase
    .from("tracked_links")
    .update({
      click_count: link.click_count + 1,
      first_clicked_at: link.first_clicked_at ?? now,
      last_clicked_at: now,
    })
    .eq("id", link.id);

  // Atualizar message_log se houver
  if (link.message_log_id) {
    await supabase
      .from("message_logs")
      .update({
        clicked: true,
        clicked_url: link.original_url,
        clicked_at: link.first_clicked_at ?? now,
      })
      .eq("id", link.message_log_id)
      .is("clicked_at", null); // só registra o primeiro clique
  }

  return NextResponse.redirect(link.original_url);
}
