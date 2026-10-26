// Edge Function "norica-transcribe": recebe o áudio gravado no app e devolve o texto.
// Exige login. A chave da Groq fica só no servidor.
// Deploy: supabase functions deploy norica-transcribe

import { createClient } from "npm:@supabase/supabase-js@2";
import { groqTranscribe } from "../_shared/groq.ts";
import { consume } from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return json({ error: "Faça login para continuar" }, 401);

    // Limite diário de transcrições (evita uso abusivo da IA de voz).
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const limited = await consume(admin, user.id, "transcribe");
    if (limited) return json({ error: limited }, 429);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Áudio não enviado" }, 400);
    if (file.size > MAX_AUDIO_BYTES) return json({ error: "Áudio muito longo" }, 413);

    const text = await groqTranscribe(file);
    return json({ text });
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível transcrever o áudio" }, 500);
  }
});
