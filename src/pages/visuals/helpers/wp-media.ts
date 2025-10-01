export function buildMediaURL(base: string, q: Record<string, any>){
  const u = new URL(`${base.replace(/\/$/, '')}/wp-json/wp/v2/media`);
  const allow = ['per_page','page','orderby','order','search','author','mime_type','after','before','media_tag','media_category'];
  for (const k of allow){ if (q[k] != null && q[k] !== '') u.searchParams.set(k, String(q[k])); }
  return u.toString();
}
