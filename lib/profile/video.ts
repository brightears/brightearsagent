// YouTube/Vimeo URL → privacy-friendly embed URL for the hosted EPK.
// Pure + defensive: anything unrecognized returns null and the EPK simply
// skips the video block (never iframe an arbitrary URL).

export function videoEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const id = (s: string | null | undefined) =>
    s && /^[\w-]{4,}$/.test(s) ? s : null;

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const fromQuery = id(url.searchParams.get("v"));
    const fromPath = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{4,})/);
    const videoId = fromQuery ?? id(fromPath?.[1]);
    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
  }
  if (host === "youtu.be") {
    const videoId = id(url.pathname.slice(1).split("/")[0]);
    return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/(\d{6,})/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return null;
}
