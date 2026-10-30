'use client';

export interface Gif {
  id: string;
  url: string;
  preview: string;
  title: string;
  width: number;
  height: number;
}

const KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
export const gifSearchAvailable = Boolean(KEY);

interface GiphyItem {
  id: string;
  title: string;
  images: {
    fixed_width: { url: string; width: string; height: string };
    fixed_width_small?: { url: string };
    downsized_medium?: { url: string };
  };
}

export async function searchGifs(query: string): Promise<Gif[]> {
  if (!KEY) return [];
  const endpoint = query.trim() ? 'search' : 'trending';
  const params = new URLSearchParams({ api_key: KEY, limit: '24', rating: 'pg-13', q: query });
  const res = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params}`);
  if (!res.ok) throw new Error(`GIF search failed (${res.status})`);
  const json = (await res.json()) as { data: GiphyItem[] };
  return json.data.map((g) => ({
    id: g.id,
    title: g.title,
    url: g.images.downsized_medium?.url ?? g.images.fixed_width.url,
    preview: g.images.fixed_width_small?.url ?? g.images.fixed_width.url,
    width: Number(g.images.fixed_width.width),
    height: Number(g.images.fixed_width.height),
  }));
}
