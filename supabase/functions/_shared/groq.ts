// Chamadas à Groq feitas SÓ no servidor. A chave fica no secret GROQ_API_KEY.
//
// Atenção: a Groq desliga modelos antigos de tempos em tempos
// (llama-3.1-8b-instant e llama-3.3-70b-versatile foram desligados em 16/08/2026).
// Por isso os modelos podem ser trocados por secret, sem publicar nova versão do app:
//   supabase secrets set GROQ_CHAT_MODEL=openai/gpt-oss-120b GROQ_FAST_MODEL=openai/gpt-oss-20b
// Lista de desligamentos: https://console.groq.com/docs/deprecations

const GROQ_URL = "https://api.groq.com/openai/v1";

export const CHAT_MODEL = Deno.env.get("GROQ_CHAT_MODEL") ?? "openai/gpt-oss-120b";
export const FAST_MODEL = Deno.env.get("GROQ_FAST_MODEL") ?? "openai/gpt-oss-20b";
export const TRANSCRIBE_MODEL = Deno.env.get("GROQ_TRANSCRIBE_MODEL") ?? "whisper-large-v3";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class GroqError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function apiKey(): string {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new GroqError(500, "GROQ_API_KEY não configurada");
  return key;
}

const isReasoningModel = (model: string) => model.startsWith("openai/gpt-oss");

export async function groqChat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const model = opts.model ?? CHAT_MODEL;
  const reasoning = isReasoningModel(model);
  const res = await fetch(`${GROQ_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      // Nos modelos com raciocínio, o limite inclui o "pensamento" interno: damos folga.
      max_completion_tokens: (opts.maxTokens ?? 600) + (reasoning ? 600 : 0),
      ...(reasoning ? { reasoning_effort: "low", include_reasoning: false } : {}),
    }),
  });
  if (!res.ok) {
    throw new GroqError(res.status, `Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/** Extrai o primeiro objeto JSON de uma resposta de texto (o modelo às vezes adiciona texto em volta). */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_e) {
    return null;
  }
}

export async function groqTranscribe(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name || "recording.webm");
  form.append("model", TRANSCRIBE_MODEL);
  form.append("language", "pt");
  const res = await fetch(`${GROQ_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) throw new GroqError(res.status, `Groq transcrição ${res.status}`);
  const data = await res.json();
  return (data.text ?? "").trim();
}
