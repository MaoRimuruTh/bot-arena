import { firebaseConfig, FB_VERSION } from "./config.js?v=20261113004005";
const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
const { initializeApp } = await import(base + "firebase-app.js");
const A = await import(base + "firebase-auth.js");
const F = await import(base + "firebase-firestore.js");

export const app = initializeApp(firebaseConfig);
export const auth = A.getAuth(app);
export const db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
export { F };

export async function signIn() {
  const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
  try { await A.signInWithPopup(auth, p); }
  catch (e) {
    if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return A.signInWithRedirect(auth, p);
    throw e;
  }
}
export const signOut = () => A.signOut(auth);
export const onUser = (cb) => A.onAuthStateChanged(auth, cb);

export const Me = { user: null, profile: null, uid: null };
export async function ensureProfile(user) {
  const ref = F.doc(db, "users", user.uid);
  let snap = await F.getDoc(ref).catch(() => null);
  if (!snap || !snap.exists()) {
    const baseDoc = { name: user.displayName || "ผู้เล่น", email: user.email || "", photo: user.photoURL || "", createdAt: Date.now(), lastSeen: Date.now() };
    // the very first account becomes the owner (rules allow it only while meta/owner does not exist)
    try { const b = F.writeBatch(db); b.set(ref, { ...baseDoc, status: "approved", role: "owner" }); b.set(F.doc(db, "meta", "owner"), { uid: user.uid, at: Date.now() }); await b.commit(); }
    catch { await F.setDoc(ref, { ...baseDoc, status: "pending", role: "member" }); }
    snap = await F.getDoc(ref);
  } else {
    F.updateDoc(ref, { lastSeen: Date.now(), name: user.displayName || snap.data().name, photo: user.photoURL || "" }).catch(() => {});
  }
  Me.user = user; Me.uid = user.uid; Me.profile = snap.data();
  return Me.profile;
}
export const myName = () => (Me.profile && (Me.profile.nick || Me.profile.name)) || "ผู้เล่น";
export const myAvatar = () => (Me.profile && (Me.profile.avatar || Me.profile.photo)) || "";
export const saveProfile = (patch) => F.updateDoc(F.doc(db, "users", Me.uid), patch);
export const watchMe = (cb) => F.onSnapshot(F.doc(db, "users", Me.uid), (s) => { Me.profile = s.data(); cb(Me.profile); }, () => {});

// ---------- live data ----------
export const Data = { decks: [], matches: [], owned: {}, skins: {}, favs: {}, prices: {}, users: [], meta: {}, ready: { decks: false, matches: false }, listeners: new Set() };
const emit = () => Data.listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
const unsubs = [];
export function startData() {
  unsubs.forEach((u) => u()); unsubs.length = 0;
  unsubs.push(F.onSnapshot(F.collection(db, "decks"), (s) => { Data.decks = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); Data.ready.decks = true; emit(); }, (e) => { console.warn(e); Data.ready.decks = true; emit(); }));
  unsubs.push(F.onSnapshot(F.query(F.collection(db, "matches"), F.where("uid", "==", Me.uid)), (s) => { Data.matches = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || 0) - (a.at || 0)); Data.ready.matches = true; emit(); }, (e) => { console.warn(e); Data.ready.matches = true; emit(); }));
  unsubs.push(F.onSnapshot(F.doc(db, "users", Me.uid, "private", "owned"), (s) => { Data.owned = (s.exists() && s.data().cards) || {}; emit(); }, () => {}));
  unsubs.push(F.onSnapshot(F.doc(db, "users", Me.uid, "private", "skins"), (s) => { Data.skinDoc = s.exists() ? s.data() : null; Data.refreshSkins(); emit(); }, () => {}));
  unsubs.push(F.onSnapshot(F.doc(db, "users", Me.uid, "private", "favs"), (s) => { Data.favs = (s.exists() && s.data().cards) || {}; emit(); }, () => {}));
  unsubs.push(F.onSnapshot(F.doc(db, "users", Me.uid, "private", "prices"), (s) => { Data.prices = (s.exists() && s.data().cards) || {}; emit(); }, () => {}));
  unsubs.push(F.onSnapshot(F.doc(db, "meta", "config"), (s) => { Data.meta = (s.exists() && s.data()) || {}; emit(); }, () => {}));
  if (Me.profile && Me.profile.role === "owner") unsubs.push(F.onSnapshot(F.collection(db, "users"), (s) => { Data.users = s.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); }, () => {}));
}
export async function saveDeck(deck) {
  const now = Date.now(); const id = deck.id || F.doc(F.collection(db, "decks")).id;
  const body = { name: deck.name || "เด็คไม่มีชื่อ", owner: Me.uid, ownerName: myName(), main: deck.main || {}, life: deck.life || [], ace: deck.ace || [], style: deck.style || "", plan: deck.plan || "", notes: deck.notes || "", updatedAt: now, createdAt: deck.createdAt || now };
  await F.setDoc(F.doc(db, "decks", id), body); return id;
}
export const deleteDeck = (id) => F.deleteDoc(F.doc(db, "decks", id));
let ownTimer = null;
export function saveOwned() { clearTimeout(ownTimer); ownTimer = setTimeout(() => F.setDoc(F.doc(db, "users", Me.uid, "private", "owned"), { cards: Data.owned, updatedAt: Date.now() }).catch((e) => console.warn(e)), 700); }
// Skins are saved by print code ("BT09-042-UR" → "BT09-042-SCR") so they survive updates to the official card
// data; in memory they stay a map of card index → card index. cards.js provides the codec once cards are loaded.
Data.skinDoc = null; Data.skinCodec = null;
Data.refreshSkins = () => {
  const doc = Data.skinDoc, codec = Data.skinCodec, ready = codec && codec.ready();
  if (!doc) { Data.skins = {}; return; }
  if (doc.prints) { if (ready) Data.skins = codec.decode(doc.prints); return; } // wait for the card data before decoding
  Data.skins = doc.cards || {}; // old format (card indexes): convert it once, while the indexes still match
  if (ready && Object.keys(Data.skins).length) saveSkins();
};
let skinTimer = null;
export function saveSkins() { clearTimeout(skinTimer); skinTimer = setTimeout(() => { const c = Data.skinCodec; const body = c && c.ready() ? { prints: c.encode(Data.skins), updatedAt: Date.now() } : { cards: Data.skins, updatedAt: Date.now() };
  F.setDoc(F.doc(db, "users", Me.uid, "private", "skins"), body).catch((e) => console.warn(e)); }, 500); }
let favTimer = null; // favourite cards, keyed by "print-rarity" so the list survives card-data updates
export function saveFavs() { clearTimeout(favTimer); favTimer = setTimeout(() => F.setDoc(F.doc(db, "users", Me.uid, "private", "favs"), { cards: Data.favs, updatedAt: Date.now() }).catch((e) => console.warn(e)), 400); }
// prices the player noted down from shops / marketplaces (reference only — nothing is bought or sold here)
export function savePrices() { return F.setDoc(F.doc(db, "users", Me.uid, "private", "prices"), { cards: Data.prices, updatedAt: Date.now() }).catch((e) => console.warn(e)); }
// questions to Ciel from inside the app (owner account only, see firestore.rules)
const inboxCol = () => F.collection(db, "users", Me.uid, "inbox");
export const addQuestion = ({ text, ctx }) => F.setDoc(F.doc(inboxCol()), { text: String(text).slice(0, 2000), ctx: ctx || {}, at: Date.now(), answer: "", answeredAt: 0 });
export const watchInbox = (cb) => F.onSnapshot(inboxCol(), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || 0) - (a.at || 0))), () => cb([]));
export const answerQuestion = (id, answer) => F.updateDoc(F.doc(inboxCol(), id), { answer: String(answer).slice(0, 4000), answeredAt: Date.now() });
export const deleteQuestion = (id) => F.deleteDoc(F.doc(inboxCol(), id));
export const saveMatch = (id, body) => F.setDoc(F.doc(db, "matches", id), body);
export const setUserStatus = (uid, status) => F.updateDoc(F.doc(db, "users", uid), { status });
export const setMeta = (patch) => F.setDoc(F.doc(db, "meta", "config"), patch, { merge: true });
// games (friends)
export const gameRef = (id) => F.doc(db, "games", id);
export const newGameId = () => F.doc(F.collection(db, "games")).id;
export const watchLobby = (cb) => F.onSnapshot(F.query(F.collection(db, "games"), F.where("status", "==", "waiting")), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
// finished games (any approved member may read them): the friends' ladder is worked out from these, read once when needed
export const finishedGames = () => F.getDocs(F.query(F.collection(db, "games"), F.where("status", "==", "over"))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })), () => []);
// games being played right now, so friends can watch (hands stay hidden) or a player can get back into their own game
export const watchPlaying = (cb) => F.onSnapshot(F.query(F.collection(db, "games"), F.where("status", "==", "playing")), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
