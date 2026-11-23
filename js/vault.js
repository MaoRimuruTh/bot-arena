// The owner's own things for the table: his playmat picture, card sleeve and 3D figure. They live in his private space in
// the database (users/{uid}/private: the database's rules let no other account read or write there), never in the site's
// code, and the site offers no way to download them. If he chooses, a smaller copy of the mat or the sleeve goes into
// meta/config (every approved member can read it, only the owner can write it) so his opponents see it on their table.
// The figure can be shown too, as a lighter copy (fewer polygons: fine on the table, poor for printing). Shown copies are
// stored scrambled, so browsing the database shows no picture or model file; that keeps out casual copying, not a determined
// expert, since whatever a browser draws has to reach it.
import { db, F, Me, Data, setMeta } from "./fb.js?v=20261123130733";
import { OwnArt, CARDS, baseId, lifeArtMap } from "./cards.js?v=20261123130733";

const CHUNK = 700 * 1024, MAX = 6 * 1024 * 1024;
const ref = (id) => F.doc(db, "users", Me.uid, "private", id);
const partRef = (kind, k) => ref(`vault-${kind}-${k}`);
export const isOwner = () => !!(Me.profile && Me.profile.role === "owner" && Me.profile.status === "approved");
export const Vault = { m: null, has: (k) => !!(isOwner() && Vault.m && Vault.m[k] && Vault.m[k].parts) };
const subs = new Set();
export const onVault = (f) => { subs.add(f); return () => subs.delete(f); };
const emit = () => subs.forEach((f) => { try { f(); } catch (e) { console.warn(e); } });
let unsub = null;
// the list of what is stored (small); the pictures themselves are read only when the table needs them
export function startVault() {
  if (unsub) { unsub(); unsub = null; } Vault.m = null;
  if (!isOwner()) return;
  unsub = F.onSnapshot(ref("vault"), (s) => { Vault.m = s.exists() ? s.data() : {}; loadOwnArt(); emit(); }, (e) => { console.warn(e); Vault.m = {}; emit(); });
  watchShown();
}

// the owner's fan-art pictures for his cards: entries "art_<print>" ({ p: the card's print code }); a picture shows on
// every print of that card and on every other LIFE card with the same ability (cards.js lifeArtMap), on his own screen
const artUrls = new Map(), artBusy = new Set(); let artTry = null;
export let onArt = null; export const setOnArt = (f) => { onArt = f; };
export function loadOwnArt() {
  if (!isOwner() || !Vault.m) { OwnArt.m.clear(); return; }
  if (!CARDS || !CARDS.length) { clearTimeout(artTry); artTry = setTimeout(loadOwnArt, 1500); return; } // the card list is still loading
  const items = Object.entries(Vault.m).filter(([k, it]) => k.startsWith("art_") && it && it.parts && it.p).sort(([a], [b]) => a.localeCompare(b));
  const apply = () => { const m = lifeArtMap(items.filter(([k, it]) => artUrls.has(k + ":" + it.v)).map(([k, it]) => [it.p, artUrls.get(k + ":" + it.v)])); OwnArt.m.clear(); for (const [b, u] of m) OwnArt.m.set(b, u); };
  apply();
  for (const [k, it] of items) { const kv = k + ":" + it.v; if (artUrls.has(kv) || artBusy.has(kv)) continue; artBusy.add(kv);
    vaultBlob(k).then((bl) => { artBusy.delete(kv); if (!bl) return; artUrls.set(kv, URL.createObjectURL(bl)); apply(); if (onArt) onArt(); emit(); }).catch((e) => { artBusy.delete(kv); console.warn("own art", e); }); }
}
// ---------- the fan-art LIFE pictures shown to opponents (full quality) ----------
// Each one he chooses to show is copied, scrambled like the other shown things, into its own document in "shown" (the
// database's rules: every approved member reads, only the owner writes), so a picture can be as large as the original.
const shownRef = (p) => F.doc(db, "shown", "art-" + String(p).replace(/[^A-Za-z0-9]/g, "_"));
export const ShownArt = { mine: new Set(), err: "" };
let shownUnsub = null;
function watchShown() {
  if (shownUnsub) { shownUnsub(); shownUnsub = null; } ShownArt.mine = new Set(); ShownArt.err = "";
  if (!isOwner() || !F.collection || !F.query) return; // (the local test database has no queries)
  try { shownUnsub = F.onSnapshot(F.query(F.collection(db, "shown"), F.where("by", "==", Me.uid)), (q) => { ShownArt.mine = new Set(q.docs.map((d) => d.data().p)); ShownArt.err = ""; emit(); },
    (e) => { console.warn("shown", e); ShownArt.err = "rules"; emit(); }); } catch (e) { console.warn("shown", e); }
}
export async function artShow(p, on) {
  if (!isOwner()) return;
  if (!on) { await F.deleteDoc(shownRef(p)); return; }
  const bl = await vaultBlob("art_" + String(p).replace(/[^A-Za-z0-9]/g, "_")); if (!bl) throw new Error("ยังโหลดรูปไม่เสร็จ");
  if (bl.size > 950 * 1024) throw new Error("รูปใหญ่เกิน 950 KB");
  const v = Date.now(); await F.setDoc(shownRef(p), { img: F.Bytes.fromUint8Array(mix(new Uint8Array(await bl.arrayBuffer()), v)), v, by: Me.uid, type: bl.type || "image/jpeg", p });
}
// on anyone's screen in a game: the pictures the other player (if he is the owner) chose to show, on his seat
let shownFor = null;
export function syncShownArt(players) {
  const q = players ? players.findIndex((P) => P && P.uid && P.uid !== Me.uid) : -1, P = q >= 0 ? players[q] : null;
  if (!P) { OwnArt.oseat = null; return; }
  if (shownFor && shownFor.uid === P.uid) { OwnArt.oseat = shownFor.ready ? q : null; return; }
  shownFor = { uid: P.uid, ready: false }; const me = shownFor; OwnArt.sm = new Map(); OwnArt.oseat = null;
  if (!F.getDocs || !F.query) return;
  Promise.resolve().then(() => F.getDocs(F.query(F.collection(db, "shown"), F.where("by", "==", P.uid)))).then((qs) => {
    if (shownFor !== me) return; const items = qs.docs.map((d) => d.data()).filter((d) => d && d.img && d.p).sort((a, b) => String(a.p).localeCompare(String(b.p)));
    const m = lifeArtMap(items.map((d) => [d.p, URL.createObjectURL(new Blob([mix(d.img.toUint8Array(), d.v)], { type: d.type || "image/jpeg" }))]));
    OwnArt.sm = m; me.ready = true; if (m.size) { OwnArt.oseat = q; if (onArt) onArt(); emit(); }
  }).catch((e) => console.warn("shown art", e));
}
// a stored file comes back in pieces of up to 700 KB (a database document holds at most 1 MB); the copy kept on this device
// is used while it is the current version, so a picture is fetched again only after it changes
async function readPart(kind, k, v) {
  const r = partRef(kind, k);
  try { const c = await F.getDocFromCache(r); if (c.exists() && c.data().v === v) return c.data().b; } catch { /* not on this device yet */ }
  const s = await F.getDocFromServer(r);
  if (!s.exists() || s.data().v !== v) throw new Error("ไฟล์ส่วนตัวไม่ครบ ลองอัปโหลดใหม่");
  return s.data().b;
}
const blobs = new Map();
export function vaultBlob(kind) {
  const it = Vault.has(kind) && Vault.m[kind]; if (!it) return Promise.resolve(null);
  const key = kind + ":" + it.v;
  if (!blobs.has(key)) {
    const p = (async () => { const bufs = []; for (let k = 0; k < it.parts; k++) bufs.push((await readPart(kind, k, it.v)).toUint8Array()); return new Blob(bufs, { type: it.type || "application/octet-stream" }); })();
    blobs.set(key, p); p.catch(() => blobs.delete(key));
  }
  return blobs.get(key);
}
// store a file (replacing the one before): its pieces first, then the list, so the list never points at missing pieces
export async function vaultPut(kind, blob, extra = {}) {
  if (!isOwner()) throw new Error("เฉพาะบัญชีเจ้าของสนาม");
  if (blob.size > MAX) throw new Error("ไฟล์ใหญ่เกิน 6 MB");
  const buf = new Uint8Array(await blob.arrayBuffer()), v = Date.now(), n = Math.max(1, Math.ceil(buf.length / CHUNK)), old = Vault.m && Vault.m[kind];
  for (let k = 0; k < n; k++) await F.setDoc(partRef(kind, k), { b: F.Bytes.fromUint8Array(buf.subarray(k * CHUNK, (k + 1) * CHUNK)), v });
  await F.setDoc(ref("vault"), { [kind]: { v, parts: n, type: blob.type || "", size: buf.length, ...extra } }, { merge: true });
  if (old) for (let k = n; k < (old.parts || 0); k++) F.deleteDoc(partRef(kind, k)).catch(() => {});
}
export const vaultMeta = (kind, patch) => F.setDoc(ref("vault"), { [kind]: patch }, { merge: true });
export async function vaultDrop(kind) {
  const old = Vault.m && Vault.m[kind];
  await F.setDoc(ref("vault"), { [kind]: F.deleteField() }, { merge: true });
  if (old) for (let k = 0; k < (old.parts || 0); k++) F.deleteDoc(partRef(kind, k)).catch(() => {});
  if (kind !== "fig" && !kind.startsWith("art_")) await vaultShow(kind, null);
  if (kind.startsWith("art_") && old && old.p) await artShow(old.p, false).catch(() => {});
}
// a symmetric scramble (xorshift keystream from the version): applying it twice gives the bytes back
function mix(bytes, v) { const out = new Uint8Array(bytes.length); let x = (v % 2147483647) | 0 || 0x9e3779b9; for (let i = 0; i < bytes.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; out[i] = bytes[i] ^ (x & 255); } return out; }
// the copy opponents see (or null: stop showing it): each under 420 KB, and all of them together under 940 KB, since they
// share one settings document (the database holds at most 1 MB in one)
const shownBytes = (but) => Object.entries((Data.meta && Data.meta.show) || {}).reduce((n, [k, v]) => n + (k !== but && v && v.img ? v.img.toUint8Array().length : 0), 0);
export async function vaultShow(kind, blob, extra = {}) {
  if (!isOwner()) return;
  if (blob && blob.size > 420 * 1024) throw new Error("ฉบับให้เพื่อนเห็นต้องเล็กกว่า 420 KB");
  if (blob && shownBytes(kind) + blob.size > 940 * 1024) throw new Error("ของที่ให้คู่แข่งเห็นรวมกันเกิน 940 KB ลองซ่อนอย่างอื่นก่อน");
  const v = Date.now(), body = blob ? { img: F.Bytes.fromUint8Array(mix(new Uint8Array(await blob.arrayBuffer()), v)), v, by: Me.uid, type: blob.type || "", ...extra } : F.deleteField();
  await setMeta({ show: { [kind]: body } });
}
// the owner's own shown copy, unscrambled (to look at in Settings)
export const shownBlob = (kind) => { const sh = Data.meta && Data.meta.show && Data.meta.show[kind]; return sh && sh.img && sh.by === Me.uid ? Promise.resolve(new Blob([mix(sh.img.toUint8Array(), sh.v)], { type: sh.type || "" })) : Promise.resolve(null); };
export const shownNow = (kind) => { const sh = Data.meta && Data.meta.show && Data.meta.show[kind]; return !!(sh && sh.img && sh.by === Me.uid); };

// ---------- what the table draws for a player's own things ----------
// On the owner's screen: his full pictures. On anyone else's: the copies he chose to show (or nothing). Each picture is
// decoded once into a bitmap; the table is told when one is ready so it can redraw.
const objs = new Map(); let onReady = null;
export const setOnReady = (f) => { onReady = f; };
function bitmap(key, get, make) {
  if (objs.has(key)) return objs.get(key);
  const o = make(); objs.set(key, o);
  get().then((b) => (b ? createImageBitmap(b) : null)).then((bm) => { if (!bm) return; o.img = bm; if (onReady) onReady(o); }).catch((e) => { console.warn("vault", e); objs.delete(key); });
  return o;
}
const showOf = (kind, uid) => { const sh = Data.meta && Data.meta.show && Data.meta.show[kind]; return sh && sh.img && uid && sh.by === uid ? sh : null; };
const showBlob = (sh) => () => Promise.resolve(new Blob([mix(sh.img.toUint8Array(), sh.v)], { type: sh.type || "image/jpeg" }));
const matObj = (it) => () => ({ name: "ผ้าปูของเจ้าของสนาม", lac: "#0d0b12", edge: "rgba(150,180,235,", kind: "img", img: null, veil: it.veil != null ? +it.veil : 0.38 });
export function customMat(P) {
  if (!P || P.mat !== "own") return null;
  if (P.uid && P.uid === Me.uid && Vault.has("mat")) { const it = Vault.m.mat; return bitmap("mat:" + it.v + ":" + (it.veil ?? ""), () => vaultBlob("mat"), matObj(it)); }
  const sh = showOf("mat", P.uid); return sh ? bitmap("matS:" + sh.v, showBlob(sh), matObj(sh)) : null;
}
export function customSleeve(P) {
  if (!P || P.sleeve !== "own") return null;
  if (P.uid && P.uid === Me.uid && Vault.has("sleeve")) { const it = Vault.m.sleeve; return bitmap("sl:" + it.v, () => vaultBlob("sleeve"), () => ({ img: null, sleeve: true })); }
  const sh = showOf("sleeve", P.uid); return sh ? bitmap("slS:" + sh.v, showBlob(sh), () => ({ img: null, sleeve: true })) : null;
}
// the picture standee: his own picture printed on a flat stand beside the table (a card on a base, never a model);
// the full picture on his screen, the smaller copy he shows on anyone else's
const stands = new Map();
export function customStand(P) {
  if (!P || P.av3 !== "stand" || !P.uid) return null;
  let key, get;
  if (P.uid === Me.uid && Vault.has("stand")) { const it = Vault.m.stand; key = "st:" + it.v; get = () => vaultBlob("stand"); }
  else { const sh = showOf("stand", P.uid); if (!sh) return null; key = "stS:" + sh.v; get = showBlob(sh); }
  if (!stands.has(key)) stands.set(key, { key, h: 1.3, stand: true, finish: "", bmp: get().then((b) => (b ? createImageBitmap(b) : null)).catch(() => null) });
  return stands.get(key);
}
// the figure: the full model on the owner's screen, the lighter copy he shows on anyone else's
const figs = new Map();
export function customFig(P) {
  if (!P || P.av3 !== "own" || !P.uid) return null;
  let key, get, finish;
  if (P.uid === Me.uid && Vault.has("fig")) { const it = Vault.m.fig; key = "fig:" + it.v; get = () => vaultBlob("fig"); finish = it.finish; }
  else { const sh = showOf("fig", P.uid); if (!sh) return null; key = "figS:" + sh.v; get = showBlob(sh); finish = sh.finish; }
  if (!figs.has(key)) figs.set(key, { key, h: 1.4, url: get().then((b) => (b ? URL.createObjectURL(b) : null)) });
  const f = figs.get(key); f.finish = finish || ""; return f; // no finish chosen: the file's own colours, or porcelain for an unpainted model
}
