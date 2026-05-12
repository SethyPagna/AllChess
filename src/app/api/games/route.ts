import { NextResponse } from "next/server";
import { z } from "zod";

import { createInitialState } from "@/lib/variants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createGameSchema = z.object({
  variantKey: z.string().default("classic"),
  privateRoom: z.boolean().default(false)
});

export async function POST(request: Request) {
  const body = createGameSchema.parse(await request.json().catch(() => ({})));
  const state = createInitialState(body.variantKey);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      mode: "demo",
      game: {
        id: state.id,
        variant_key: body.variantKey,
        status: "active",
        board_state: state
      }
    });
  }

  const { data, error } = await supabase
    .from("games")
    .insert({
      id: state.id,
      variant_key: body.variantKey,
      status: "waiting",
      board_state: state,
      private_code: body.privateRoom ? Math.random().toString(36).slice(2, 8).toUpperCase() : null
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "supabase", game: data });
}
