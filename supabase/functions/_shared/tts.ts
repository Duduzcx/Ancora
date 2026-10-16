// Voz natural da Nórica (Gemini TTS). Opcional: só funciona com o secret GEMINI_API_KEY.
//   supabase secrets set GEMINI_API_KEY=...
//   (opcional) supabase secrets set GEMINI_TTS_MODEL=gemini-3.8-flash-tts
// Sem a chave, o app lê com a voz do próprio celular.

export const TTS_VOICES: Record<string, { voice: string; label: string }> = {
  serena: { voice: "Sulafat", label: "Serena (calorosa)" },
  suave: { voice: "Achernar", label: "Suave" },
  gentil: { voice: "Vindemiatrix", label: "Gentil" },
  amiga: { voice: "Achird", label: "Amiga" },
  calmo: { voice: "Algieba", label: "Calmo (masculina)" },
  sereno: { voice: "Umbriel", label: "Sereno (masculina)" },
};

const STYLE = "voz calma, acolhedora e pausada, em português do Brasil, como uma amiga que escuta sem pressa";

export const ttsConfigured = () => !!Deno.env.get("GEMINI_API_KEY");

function findAudio(node: unknown): { data: string; mime?: string } | null {
  if (!node || typeof node !== "object") return null;
  const o = node as Record<string, unknown>;
  // Formato "interactions": { type: "audio", data, mime_type }
  if (o.type === "audio" && typeof o.data === "string") return { data: o.data, mime: (o.mime_type ?? o.mimeType) as string | undefined };
  // Formato generateContent: { inlineData: { data, mimeType } }
  const inline = (o.inlineData ?? o.inline_data) as Record<string, unknown> | undefined;
  if (inline && typeof inline.data === "string") return { data: inline.data, mime: (inline.mimeType ?? inline.mime_type) as string | undefined };
  for (const v of Object.values(o)) {
    const found = Array.isArray(v) ? v.map(findAudio).find(Boolean) ?? null : findAudio(v);
    if (found) return found;
  }
  return null;
}

/** PCM 16-bit mono → WAV (para tocar direto no celular). */
function pcmToWavBase64(pcmB64: string, rate = 24000): string {
  const pcm = Uint8Array.from(atob(pcmB64), (c) => c.charCodeAt(0));
  const buf = new ArrayBuffer(44 + pcm.length);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Gera o áudio e devolve WAV em base64. */
export async function synthesize(text: string, voiceKey: string): Promise<{ audio: string; mime: string }> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("tts não configurado");
  const voice = (TTS_VOICES[voiceKey] ?? TTS_VOICES.serena).voice;
  const model = Deno.env.get("GEMINI_TTS_MODEL") || "gemini-3.8-flash-tts";
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: STYLE }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const found = findAudio(await res.json());
  if (!found) throw new Error("tts sem áudio na resposta");
  const mime = (found.mime || "audio/wav").toLowerCase();
  if (mime.includes("wav")) return { audio: found.data, mime: "audio/wav" };
  if (mime.includes("l16") || mime.includes("pcm")) {
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1]) || 24000;
    return { audio: pcmToWavBase64(found.data, rate), mime: "audio/wav" };
  }
  return { audio: found.data, mime };
}
