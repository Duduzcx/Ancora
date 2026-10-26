// Busca de videoaulas no YouTube (YouTube Data API v3).
// Secret: YOUTUBE_API_KEY. Sem a chave (ou sem cota), o app mostra um link de busca no YouTube.

export type Video = { id: string; title: string; channel: string; thumb: string; url: string };

export function youtubeConfigured(): boolean {
  return !!Deno.env.get("YOUTUBE_API_KEY");
}

export function searchUrl(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Até 3 vídeos em português, com busca segura. Lança erro se a API falhar (cota, chave inválida). */
export async function searchVideos(q: string): Promise<Video[]> {
  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (!key) throw new Error("sem chave");
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "3", q: `${q} aula`,
    relevanceLanguage: "pt", regionCode: "BR", safeSearch: "strict", videoEmbeddable: "true", key,
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return ((data.items ?? []) as { id?: { videoId?: string }; snippet?: Record<string, unknown> }[])
    .filter((i) => i.id?.videoId)
    .map((i) => {
      const sn = i.snippet ?? {};
      const thumbs = (sn.thumbnails ?? {}) as Record<string, { url?: string }>;
      return {
        id: i.id!.videoId!,
        title: decode(String(sn.title ?? "")).slice(0, 120),
        channel: decode(String(sn.channelTitle ?? "")).slice(0, 60),
        thumb: thumbs.medium?.url ?? thumbs.default?.url ?? "",
        url: `https://www.youtube.com/watch?v=${i.id!.videoId}`,
      };
    });
}
