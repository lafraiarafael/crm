import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const customerSchema = z.object({
  restaurant_id: z.string().uuid(),
  full_name: z.string().min(2),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  consent_whatsapp: z.boolean().default(false),
  consent_email: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customers: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const parsed = customerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid customer data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("customers")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ customer: data }, { status: 201 });
}