// Official card rulings: the FAQ on bottcg.com (questions players sent in, answered by the game's team). Read live from
// the official CDN the first time a card is opened, kept in memory only; the answers are shown with a link to the page.
import { CARD_SOURCE } from "./config.js?v=20261114123802";
let cache = null, loading = null;
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();
export function loadFaq() {
  if (cache) return Promise.resolve(cache);
  if (!loading) loading = (async () => {
    const meta = await fetch(CARD_SOURCE.faqMeta, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error("faq meta " + r.status); return r.json(); });
    const d = await fetch(`${CARD_SOURCE.faqData}?v=${encodeURIComponent(meta.version || "")}`).then((r) => { if (!r.ok) throw new Error("faq " + r.status); return r.json(); });
    const m = new Map(); for (const [k, v] of Object.entries((d && d.faqs) || {})) m.set(norm(k), (Array.isArray(v) ? v : [v]).filter((q) => q && q.question));
    cache = m; return m;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}
// the questions about a card, by its name (prints and reprints share it)
export const faqFor = (name) => (cache && cache.get(norm(name))) || [];
