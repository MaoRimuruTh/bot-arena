import { h, clone, toast, openSheet, confirmBox, busy, lsGet, lsSet, lsDel, newId, sleep, holo } from "../util.js?v=20261110162653";
import { card, deckToList, validateDeck, deckAce, artImg, cardLine, TYPE_TH, SUB_TH, colorOf } from "../cards.js?v=20261110162653";
import { E, legalMoves, PHASE_TH, ZONE_TH, RuleError, scriptOf } from "../engine.js?v=20261110162653";
import { H, Ciel, cielPick, cielResolve, cielCoach, aiErr } from "../ai.js?v=20261110162653";
import { Arena } from "../arena3d.js?v=20261110162653";
import { autoEffect, resolveEffect } from "../effects.js?v=20261110162653";
import { Sfx } from "../sfx.js?v=20261110162653";
import { Data, Me, F, db, gameRef, newGameId, watchLobby, saveMatch, myName, myAvatar } from "../fb.js?v=20261110162653";
import { Views, cardBtn, showCard, avatarEl } from "../ui.js?v=20261110162653";
import { allDecks, deckById } from "./decks.js?v=20261110162653";

const SAVE = "bot.game";
const Setup = lsGet("bot.setup", { mode: "bot", deck: "", opp: "random", brain: "ciel" });
let G = null; // live game

// who must act now
function whoActs(s) {
  if (s.phase === "over") return null;
  if (s.phase === "mull") return s.mull[0] ? (s.mull[1] ? null : 1) : 0;
  if (s.rw) return 1 - s.rw.by;
  if (s.trig.length) return s.trig[0].seat;
  if (s.pend) return 1 - s.pend.by;
  return s.active;
}
const isBot = (s, p) => !!s.P[p].bot;
// phones/tablets: tap opens a big card view with actions instead of acting right away
const compact = () => matchMedia("(max-width: 760px)").matches;
const touchy = () => compact() || matchMedia("(pointer: coarse)").matches;
const mine = (p) => G && (G.mode === "solo" || p === G.V);

Views.play = {
  render(root, parts) {
    if (G) return G.s ? this.mountGame(root) : waitingGate(root);
    const saved = lsGet(SAVE, null);
    if (parts[0] === "deck" && parts[1]) Setup.deck = parts[1];
    this.setup(root, saved);
  },
  refresh(root, parts) { if (!G) this.render(root, parts); },
  leave() { stopGame(false); },

  setup(root, saved) {
    const decks = allDecks().filter((d) => validateDeck(d).ok);
    const mineDecks = decks.filter((d) => d.owner === Me.uid || d.starter);
    if (!mineDecks.some((d) => d.id === Setup.deck)) Setup.deck = (mineDecks[0] || {}).id || "";
    const save = () => lsSet("bot.setup", Setup);
    const deckSel = (key, list, extra) => h("select", { "aria-label": key, onchange: (e) => { Setup[key] = e.target.value; save(); draw(); } }, extra || null, list.map((d) => h("option", { value: d.id, selected: d.id === Setup[key] }, d.name + (d.starter ? " (ทางการ)" : d.owner !== Me.uid ? " · " + (d.ownerName || "เพื่อน") : ""))));
    const preview = h("div"); const right = h("div", { class: "stack" }); let lobbyUnsub = null;
    const draw = () => {
      const d = deckById(Setup.deck); const ace = d && deckAce(d);
      preview.replaceChildren(d ? h("section", { class: "hero", style: "min-height:220px" }, ace ? artImg(ace, "", "") : null, h("div", { class: "wash" }), h("div", { class: "in" }, h("span", { class: "eyebrow" }, "เด็คของคุณ"), h("h2", { style: "margin:0" }, d.name), h("div", { class: "small muted" }, ace ? "เอซ: " + ace.n : ""), h("div", { class: "row" }, deckSel("deck", mineDecks), h("a", { class: "btn sm", href: "#decks/view/" + d.id }, "ดูเด็ค")))) : h("div", { class: "empty" }, "ยังไม่มีเด็คที่ถูกกติกา ไปที่หน้าเด็คเพื่อจัด หรือคัดลอก Starter Deck"));
      if (lobbyUnsub) { lobbyUnsub(); lobbyUnsub = null; }
      const modeBtn = (k, t, s) => h("button", { class: "mode", "aria-pressed": Setup.mode === k ? "true" : "false", onclick: () => { Setup.mode = k; save(); draw(); } }, h("b", null, t), h("span", null, s));
      const body = h("div", { class: "stack" });
      if (Setup.mode === "bot") {
        body.append(h("div", { class: "row" }, h("span", { class: "small muted" }, "เด็คของบอท"), deckSel("opp", decks, h("option", { value: "random", selected: Setup.opp === "random" }, "สุ่มจาก Starter Deck"))),
          h("div", { class: "row" }, h("span", { class: "small muted" }, "สมองบอท"), h("div", { class: "seg", role: "group", "aria-label": "สมองบอท" }, [["ciel", "ชิเอล"], ["basic", "พื้นฐาน"]].map(([k, t]) => h("button", { "aria-pressed": Setup.brain === k ? "true" : "false", onclick: () => { Setup.brain = k; save(); draw(); } }, t)))),
          h("div", { class: "tiny muted" }, Setup.brain === "ciel" ? (Ciel.on() ? "ชิเอลคิดทุกจังหวะและอ่านเอฟเฟกต์การ์ดให้ (ใช้ API key ของคุณ)" : "ยังไม่ได้ใส่ API key จะใช้บอทพื้นฐานแทน") : "บอทพื้นฐานเล่นตามกติกา ข้ามเอฟเฟกต์ข้อความของตัวเอง"),
          h("button", { class: "btn gold lg", disabled: !d, onclick: () => startLocal("bot") }, "เริ่มดวล"));
      } else if (Setup.mode === "solo") {
        body.append(h("div", { class: "row" }, h("span", { class: "small muted" }, "เด็คฝั่งที่ 2"), deckSel("opp", decks, h("option", { value: "random", selected: Setup.opp === "random" }, "สุ่มจาก Starter Deck"))),
          h("div", { class: "tiny muted" }, "ควบคุมทั้งสองฝั่งเอง เหมาะกับลองคอมโบหรือเล่นกับเพื่อนบนเครื่องเดียวกัน"), h("button", { class: "btn gold lg", disabled: !d, onclick: () => startLocal("solo") }, "เริ่มเกม"));
      } else {
        const lobby = h("div", { class: "stack", style: "gap:8px" }, busy("กำลังหาห้อง…"));
        lobbyUnsub = watchLobby((rooms) => {
          const list = rooms.filter((r) => Date.now() - (r.updatedAt || 0) < 6 * 3600e3).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          lobby.replaceChildren(...(list.length ? list.map((r) => h("div", { class: "mrow", style: "cursor:default" }, avatarEl(r.hostAva, r.hostName), h("div", { class: "grow" }, h("b", null, r.hostName || "เพื่อน"), h("div", { class: "tiny muted" }, "เด็ค " + (r.hostDeck && r.hostDeck.name || ""))),
            r.host === Me.uid ? h("button", { class: "btn sm danger", onclick: () => F.deleteDoc(gameRef(r.id)).catch(() => {}) }, "ยกเลิกห้อง") : h("button", { class: "btn sm gold", disabled: !d, onclick: () => joinRoom(r) }, "เข้าร่วม"))) : [h("div", { class: "muted small" }, "ยังไม่มีห้องที่รออยู่")]));
        });
        body.append(h("div", { class: "tiny muted" }, "สร้างห้องแล้วให้เพื่อนที่ได้รับอนุมัติกดเข้าร่วมจากหน้านี้ เกมซิงก์ผ่านฐานข้อมูลแบบเรียลไทม์"),
          h("button", { class: "btn gold lg", disabled: !d, onclick: createRoom }, "สร้างห้อง"), h("div", { class: "eyebrow" }, "ห้องที่รออยู่"), lobby);
      }
      right.replaceChildren(h("div", { class: "modes" }, modeBtn("bot", "ดวลกับบอท", "ซ้อมมือกับชิเอล"), modeBtn("friend", "ดวลกับเพื่อน", "ออนไลน์ผ่านห้อง"), modeBtn("solo", "เล่นสองฝั่ง", "ทดลองคอมโบเอง")), h("div", { class: "panel" }, body));
    };
    root.replaceChildren(h("div", { class: "pagehead" }, h("div", null, h("h1", null, "สนามดวล"), h("div", { class: "muted small" }, "เล่นตาม Rule Book 3.2 · เอฟเฟกต์การ์ดให้ชิเอลอ่าน หรือจัดการเองด้วยเครื่องมือ")),
      saved && saved.s && saved.s.phase !== "over" ? h("button", { class: "btn ciel", onclick: () => resume(saved) }, `เล่นต่อ: ${saved.s.P[saved.V || 0].deckName} · เทิร์น ${saved.s.turn}`) : null),
      h("div", { class: "setup" }, preview, right));
    draw();
    this._unsubLobby = () => lobbyUnsub && lobbyUnsub();
  },

  mountGame(root) {
    if (this._unsubLobby) this._unsubLobby();
    document.body.classList.add("arena-on");
    const stage = h("div", { id: "arena" }); const hud = h("div", { class: "hud" }); G.hud = hud;
    root.replaceChildren(stage, h("div", { class: "vign" }), hud);
    try { Arena.mount(stage); } catch (e) { console.warn("3D off", e); }
    Arena.setHover((i) => { if (G.hover === i) return; G.hover = i; drawInspector(); });
    Arena.setClick(fieldClick);
    Arena.update(G.s, view(), { reset: true });
    draw(); drive();
  },
};

// ---------- start / resume ----------
const pickOpp = () => { if (Setup.opp !== "random") return deckById(Setup.opp); const st = allDecks().filter((d) => d.starter); return st[Math.floor(Math.random() * st.length)]; };
const pack = (d) => ({ ...deckToList(d), name: d.name, id: d.id });
function startLocal(mode) {
  const me = deckById(Setup.deck), op = pickOpp(); if (!me || !op) return toast("เลือกเด็คก่อน");
  const botName = Setup.brain === "ciel" && Ciel.on() ? "ชิเอล" : "บอท";
  const s = E.newGame({ players: [{ uid: Me.uid, name: myName(), ava: myAvatar() }, mode === "bot" ? { name: botName, bot: true } : { uid: Me.uid, name: "ฝั่งที่ 2" }], decks: [pack(me), pack(op)], seed: (Math.random() * 2 ** 31) | 0, first: Math.random() < 0.5 ? 0 : 1, mode });
  G = { s, V: 0, mode, brain: mode === "bot" && Setup.brain === "ciel" && Ciel.on() ? "ciel" : "basic", id: s.id, saved: false };
  persist(); go();
}
function go() { if (location.hash === "#play/game") Views.play.render(document.getElementById("view"), ["game"]); else location.hash = "#play/game"; }
function waitingGate(root) {
  const id = G.id;
  root.replaceChildren(h("div", { class: "gate" }, h("div", { class: "stack", style: "align-items:center" }, busy(G.V === 0 ? "รอเพื่อนเข้าร่วมห้อง…" : "กำลังเชื่อมต่อ…"), h("button", { class: "btn", onclick: () => { if (G && G.V === 0) F.deleteDoc(gameRef(id)).catch(() => {}); stopGame(true); location.hash = "#play"; } }, "ยกเลิก"))));
}
function resume(saved) {
  G = { ...saved, saved: false };
  if (G.mode === "friend") return openOnline(G.id, G.V);
  go();
}
function persist() { if (!G) return; if (G.mode === "friend") lsSet(SAVE, { mode: "friend", id: G.id, V: G.V, s: G.s }); else lsSet(SAVE, { s: G.s, V: G.V, mode: G.mode, brain: G.brain, id: G.id }); }
function stopGame(clear) {
  if (!G) return; if (G.unsub) G.unsub(); if (clear) lsDel(SAVE); else persist();
  Arena.unmount(); document.body.classList.remove("arena-on"); document.querySelectorAll(".banner,.dmg").forEach((e) => e.remove()); G = null;
}
// ---------- friends ----------
async function createRoom() {
  const me = deckById(Setup.deck); if (!me) return;
  const id = newGameId();
  await F.setDoc(gameRef(id), { status: "waiting", host: Me.uid, hostName: myName(), hostAva: myAvatar(), hostDeck: pack(me), seats: [Me.uid], createdAt: Date.now(), updatedAt: Date.now() });
  toast("สร้างห้องแล้ว รอเพื่อนเข้าร่วม"); openOnline(id, 0);
}
async function joinRoom(r) {
  const me = deckById(Setup.deck); if (!me) return;
  try {
    await F.runTransaction(db, async (tx) => {
      const snap = await tx.get(gameRef(r.id)); const g = snap.data(); if (!g || g.status !== "waiting") throw new Error("ห้องนี้เริ่มไปแล้ว");
      const s = E.newGame({ players: [{ uid: g.host, name: g.hostName, ava: g.hostAva || "" }, { uid: Me.uid, name: myName(), ava: myAvatar() }], decks: [g.hostDeck, pack(me)], seed: (Math.random() * 2 ** 31) | 0, first: Math.random() < 0.5 ? 0 : 1, mode: "friend", id: r.id });
      tx.update(gameRef(r.id), { status: "playing", guest: Me.uid, guestName: myName(), seats: [g.host, Me.uid], state: JSON.stringify(s), updatedAt: Date.now() });
    });
    openOnline(r.id, 1);
  } catch (e) { toast(e.message || "เข้าร่วมไม่ได้", "bad"); }
}
function openOnline(id, V) {
  G = { s: null, V, mode: "friend", id, saved: false, waiting: true };
  go();
  G.unsub = F.onSnapshot(gameRef(id), (snap) => {
    if (!G) return; const g = snap.data();
    if (!g) { toast("ห้องถูกปิดแล้ว"); stopGame(true); location.hash = "#play"; return; }
    if (!g.state) return;
    const s = JSON.parse(g.state); const first = !G.s; G.s = s; persist();
    if (first) Views.play.mountGame(document.getElementById("view")); else { Arena.update(s, view()); draw(); drive(); }
  }, (e) => { console.warn(e); toast("เชื่อมต่อห้องไม่ได้", "bad"); });
}

// ---------- actions ----------
const view = () => (G.mode === "solo" ? (whoActs(G.s) ?? G.s.active) : G.V);
async function doAct(a, p) {
  if (!G || G.lock) return false;
  if (G.mode === "friend") {
    G.lock = true;
    try {
      await F.runTransaction(db, async (tx) => { const snap = await tx.get(gameRef(G.id)); const s = JSON.parse(snap.data().state); E.apply(s, a, p); tx.update(gameRef(G.id), { state: JSON.stringify(s), status: s.phase === "over" ? "over" : "playing", updatedAt: Date.now() }); });
      G.pick = null; G.att = null; G.host = null; G.payFor = null; G.payVia = null; G.callVia = null; G.castFor = null; return true;
    } catch (e) { toast(e.message || "ทำไม่ได้", "bad"); return false; }
    finally { if (G) G.lock = false; }
  }
  try { E.apply(G.s, a, p); } catch (e) { toast(e.message, "bad"); return false; }
  G.pick = null; G.att = null; G.host = null; G.payFor = null; G.payVia = null; G.callVia = null; G.helperPick = null; G.castFor = null; persist();
  Arena.update(G.s, view()); draw(); drive();
  return true;
}
// bot / auto driver
async function drive() {
  if (!G || G.driving || !G.s) return; const s = G.s;
  if (s.phase === "over") return finish();
  const p = whoActs(s); if (p == null) return;
  if (!isBot(s, p)) { if (s.trig.length && mine(p)) humanTrig(s, p); return; }
  G.driving = true;
  try {
    await Arena.idle(); await sleep(G.brain === "ciel" ? 250 : 650); if (!G || G.s !== s) return;
    let a = null;
    if (s.phase === "mull") a = { type: "mull", iids: H.mulligan(s, p) };
    else if (s.rw) a = H.react(s, p) || { type: "pass" };
    else if (s.trig.length) {
      const t = s.trig[0];
      if (G.brain === "ciel") { G.thinking = "ชิเอลกำลังอ่านเอฟเฟกต์ " + (s.cards[t.c] || {}).n; draw(); try { const r = await cielResolve(s, t); a = { type: "trig", id: t.id, ...r }; } catch (e) { a = H.trig(s, t); toast(aiErr(e), "bad"); } }
      else a = H.trig(s, t);
    } else if (s.phase === "end" && s.need) a = { type: "discard", iids: H.discard(s, p) };
    else {
      let m = null;
      const rx = s.pend ? H.react(s, p) : null;
      if (rx) m = { a: rx, say: "ใช้ React ตอบโต้!" };
      else if (G.brain === "ciel") { G.thinking = "ชิเอลกำลังคิด…"; draw(); m = await cielPick(s, p); }
      else m = H.pick(s, p);
      if (m && m.say) G.say = m.say;
      a = m ? m.a : s.pend ? { type: "respond" } : { type: "end" };
    }
    G.thinking = null; if (!G || G.s !== s) return;
    G.driving = false;
    if (!(await doAct(a, p))) { try { E.apply(G.s, { type: "end" }, p); } catch { E.lose(G.s, p, "บอทติดสถานะ"); } Arena.update(G.s, view()); draw(); }
  } finally { if (G) G.driving = false; }
}
// player's own effects: run by themselves; stop only to ask for a choice or when unreadable
function humanTrig(s, p) {
  const t = s.trig[0];
  if (G.tk !== t.id) { G.tk = t.id; G.tpicks = []; G.ask = null; G.askSel = []; G.tmanual = false; }
  if (G.tmanual) return;
  let r = null; try { r = resolveEffect(s, t, G.tpicks, true); } catch (e) { console.warn(e); }
  if (r && r.ask) { if (!G.ask || G.ask.idx !== r.ask.idx) { G.ask = r.ask; G.askSel = []; draw(); } return; }
  if (r && r.ops) { G.ask = null; toast(`${(s.cards[t.c] || {}).n}: ${String(r.explain || "").replace(/^อ่านอัตโนมัติ: /, "")}`); doAct({ type: "trig", id: t.id, explain: r.explain, ops: r.ops }, p); return; }
  G.tmanual = true; draw();
}
function finish() {
  if (!G || G.saved) { draw(); return; } G.saved = true; const s = G.s;
  const seats = G.mode === "solo" ? [] : [G.V];
  for (const V of seats) {
    const P = s.P[V], O = s.P[1 - V];
    saveMatch(s.id + "-" + V, { uid: Me.uid, mode: G.mode, deckId: P.deckId, deckName: P.deckName, opp: O.name, oppDeck: O.deckName, result: s.winner === V ? "win" : s.winner == null ? "draw" : "loss", turns: s.turn, reason: s.reason, first: s.first === V, at: Date.now(), log: s.log.slice(-14).map((l) => l.m) }).catch((e) => console.warn(e));
  }
  lsDel(SAVE); draw();
}

// ---------- field interaction ----------
function fieldClick(i) {
  if (!G || !G.s) return; const s = G.s; const p = whoActs(s);
  if (i === "life") { if (G.att) attack(G.att, "life"); return; }
  const L = E.locate(s, i); if (!L) return; G.sel = i; Arena.select(i); drawInspector();
  const choosingTarget = G.host ? L.z === "av" : G.att && L.p !== p && (L.z === "av" || L.z === "cs");
  if (touchy() && !choosingTarget) return cardView(L.x);
  if (G.host) { if (L.z === "av") { const host = G.host; G.host = null; doAct({ type: "cast", i: host, on: i }, view()); } return; }
  if (p == null || !mine(p) || s.phase !== "battle" || s.active !== p || s.pend || s.trig.length) return;
  if (L.p === p && L.z === "av" && L.x.a) { G.att = i; draw(); return; }
  if (G.att && L.p !== p && (L.z === "av" || L.z === "cs")) attack(G.att, L.z, i);
}
function attack(att, tk, ti) {
  const s = G.s, p = s.active, P = s.P[p];
  const helpers = P.av.filter((y) => y.a && y.i !== att && (E.kw(s, y, "สามัคคี") || E.kw(s, y, "แทงหลัง")));
  if (!helpers.length) return doAct({ type: "attack", i: att, tk, ti }, p);
  G.helperPick = { att, tk, ti, sup: [] }; draw();
}

// ---------- HUD ----------
function crystals(P, opp, prevKey) {
  const prev = G[prevKey] ?? P.life.filter((x) => x.up).length; const now = P.life.filter((x) => x.up).length; G[prevKey] = now; const crit = E.critical(P);
  return h("div", { class: "crys", role: "img", "aria-label": `LIFE เหลือ ${5 - now} จาก 5` }, [0, 1, 2, 3, 4].map((k) => h("i", { class: "cry" + (opp ? " opp" : "") + (k < now ? " gone" : "") + (k < now && k >= prev ? " now" : "") + (crit ? " crit" : "") })));
}
function draw() {
  if (!G || !G.hud || !G.s) return; if (G.hoverHand != null && !G.s.P[view()].hand.some((x) => x.i === G.hoverHand)) G.hoverHand = null; const s = G.s; const V = view(); const me = s.P[V], op = s.P[1 - V]; const p = whoActs(s);
  const myTurn = p != null && mine(p);
  const hint = s.phase === "over" ? (s.winner === V ? "ชนะ! " : s.winner == null ? "เสมอ · " : "แพ้ · ") + s.reason
    : G.thinking || (p == null ? "" : !mine(p) ? `รอ ${s.P[p].name}…` : s.phase === "mull" ? "เลือกการ์ดที่จะเปลี่ยน หรือเก็บมือเดิม" : s.trig.length ? "มีเอฟเฟกต์ต้องจัดการ" : s.pend ? "ถูกโจมตี เลือกการตอบโต้" : s.phase === "main" ? "Main Phase · แตะการ์ดบนมือเพื่อเล่น" : s.phase === "battle" ? (G.att ? "เลือกเป้าหมายบนสนาม" : "Battle · เลือก Avatar ที่ตื่นเพื่อโจมตี") : s.phase === "end" && s.need ? `ทิ้งการ์ด ${s.need} ใบ` : "");
  const pile = (P, z, t) => h("button", { onclick: () => openPile(P, z) }, h("b", null, P[z].length), h("span", null, t));
  const ph = ["draw", "main", "battle", "end"];
  if (compact()) {
    G.hud.replaceChildren(
      h("div", { class: "oppbar glass" }, op.bot && !op.ava ? h("span", { class: "ava sm" }, "✦") : avatarEl(op.ava, op.name, "sm"), h("div", { class: "pname" }, h("b", null, op.name), h("span", null, `มือ ${op.hand.length} · Deck ${op.deck.length}`)), crystals(op, true, "pcOp")),
      hint ? h("div", { class: "hint" }, G.say && !mine(p ?? -1) ? "✦ " + G.say : hint) : null,
      handZone(s, V, p), promptBox(s, p),
      h("div", { class: "mbar glass" },
        h("button", { class: "btn sm", "aria-label": "เมนูเกม", onclick: () => gameMenu(s, V) }, "☰"),
        h("div", { class: "mturn" }, h("b", null, `เทิร์น ${s.turn}`), h("span", null, s.phase === "mull" ? "เปลี่ยนมือ" : PHASE_TH[s.phase])),
        crystals(me, false, "pcMe"), h("div", { class: "grow" }), ...turnButtons(s, p).filter(Boolean).slice(0, 2)));
    afterDraw(s, V, op, myTurn); return;
  }
  G.hud.replaceChildren(
    h("div", { class: "oppbar glass" }, op.bot && !op.ava ? h("span", { class: "ava" }, "✦") : avatarEl(op.ava, op.name), h("div", { class: "pname" }, h("b", null, op.name), h("span", null, `${op.deckName} · Deck ${op.deck.length}`)), crystals(op, true, "pcOp"),
      h("div", { class: "backs", "aria-label": `มือ ${op.hand.length} ใบ` }, op.hand.slice(0, 10).map(() => h("i"))), G.say ? h("span", { class: "chip gold", style: "max-width:220px;overflow:hidden;text-overflow:ellipsis" }, "✦ " + G.say) : null),
    hint ? h("div", { class: "hint" }, hint) : null,
    h("aside", { class: "inspector glass", id: "insp" }),
    h("aside", { class: "matchp glass" },
      h("div", { class: "turnline" }, h("b", null, "เทิร์น " + s.turn), h("span", null, s.phase === "mull" ? "เปลี่ยนมือ" : s.P[s.active].name)),
      h("div", { class: "phases" }, ph.map((k) => h("span", { class: s.phase === k ? "on" : "" }, PHASE_TH[k]))),
      h("div", { class: "row", style: "justify-content:space-between;flex-wrap:nowrap" }, h("span", { class: "row small", style: "gap:8px;flex-wrap:nowrap" }, avatarEl(me.ava, me.name, "me sm"), me.name), crystals(me, false, "pcMe")),
      E.critical(me) ? h("span", { class: "chip bad" }, "สาหัส! ถูกตี LIFE อีกครั้งจะแพ้") : null,
      h("div", { class: "piles" }, pile(me, "deck", "Deck"), pile(me, "hell", "นรก"), pile(me, "dark", "มิติมืด")),
      h("div", { class: "row" }, ...turnButtons(s, p)),
      h("div", { class: "row hidem" }, h("button", { class: "btn sm ciel", disabled: s.phase === "over", onclick: coach }, "ชิเอลแนะนำ"), h("button", { class: "btn sm", disabled: s.phase === "over", onclick: tools }, "เครื่องมือ"), h("button", { class: "btn sm", onclick: () => openPile(op, "hell") }, "นรกคู่แข่ง"), h("button", { class: "btn sm", "aria-pressed": Sfx.on ? "true" : "false", onclick: () => { Sfx.toggle(); Sfx.play("click"); draw(); } }, Sfx.on ? "🔊 เสียง" : "🔇 เสียง")),
      G.coach ? h("div", { class: "coachbox" }, G.coach) : null,
      h("div", { class: "glog", "aria-live": "polite" }, s.log.slice(-30).reverse().map((l) => h("div", { class: l.s === V ? "mine" : "" }, l.m)))),
    handZone(s, V, p), promptBox(s, p),
    h("button", { class: "btn sm arena-exit", onclick: () => (s.phase === "over" ? exitGame() : confirmBox("ออกจากสนาม? เกมที่ค้างจะเก็บไว้ให้เล่นต่อ", "ออก", exitGame)) }, "← ออก"));
  afterDraw(s, V, op, myTurn);
}
function afterDraw(s, V, op, myTurn) {
  const me = s.P[V];
  drawInspector();
  const targets = [];
  if (G.att) { targets.push(...op.av.map((x) => x.i), ...op.cs.map((x) => x.i)); }
  else if (myTurn && s.phase === "battle" && !s.pend && !s.trig.length) targets.push(...me.av.filter((x) => x.a).map((x) => x.i));
  if (G.host) targets.push(...s.P[0].av.map((x) => x.i), ...s.P[1].av.map((x) => x.i));
  Arena.highlight(targets); const AL = G.att && E.locate(s, G.att); Arena.setLifeTarget(!!AL && (!op.av.length || E.kw(s, AL.x, "เตะไข่")));
}
function gameMenu(s, V) {
  const me = s.P[V], op = s.P[1 - V];
  openSheet((api) => [
    h("div", { class: "row" }, ...[[me, "deck", "Deck"], [me, "hell", "นรกเรา"], [me, "dark", "มิติมืดเรา"], [op, "hell", "นรกคู่แข่ง"]].map(([P, z, t]) => h("button", { class: "btn sm", onclick: () => { api.close(); openPile(P, z); } }, `${t} ${P[z].length}`))),
    h("div", { class: "row" }, h("button", { class: "btn sm ciel", disabled: s.phase === "over", onclick: () => { api.close(); coach().then(() => G && G.coach && openSheet(h("div", { class: "coachbox" }, G.coach), { title: "ชิเอลแนะนำ" })); } }, "ชิเอลแนะนำ"), h("button", { class: "btn sm", disabled: s.phase === "over", onclick: () => { api.close(); tools(); } }, "เครื่องมือ"),
      h("button", { class: "btn sm", onclick: (e) => { Sfx.toggle(); Sfx.play("click"); e.currentTarget.textContent = Sfx.on ? "🔊 เสียงเปิด" : "🔇 เสียงปิด"; } }, Sfx.on ? "🔊 เสียงเปิด" : "🔇 เสียงปิด"),
      h("button", { class: "btn sm danger", onclick: () => { api.close(); s.phase === "over" ? exitGame() : confirmBox("ออกจากสนาม? เกมที่ค้างจะเก็บไว้ให้เล่นต่อ", "ออก", exitGame); } }, "ออกจากสนาม")),
    G.coach ? h("div", { class: "coachbox" }, G.coach) : null,
    h("div", { class: "eyebrow" }, "บันทึกเกม"), h("div", { class: "glog", style: "max-height:44vh" }, s.log.slice(-40).reverse().map((l) => h("div", { class: l.s === V ? "mine" : "" }, l.m)))], { title: `เทิร์น ${s.turn} · ${s.P[s.active].name}` });
}
// big, readable card view with the actions that make sense right now
function cardView(x) {
  const s = G.s; const p = whoActs(s); const V = view(); const L = E.locate(s, x.i); if (!L) return;
  const d = E.def(s, x); const c = d.im != null ? card(d.im) : null; const acts = []; const myMove = p != null && mine(p);
  const go = (fn) => () => { api.close(); fn(); };
  if (L.z === "hand" && L.p === V && myMove) {
    const main = s.active === p && s.phase === "main" && !s.trig.length && !s.pend;
    if (d.t === "A" && main) acts.push(["อัญเชิญ", () => handClick(x), "gold"]);
    else if (d.t === "C" && main) acts.push(["ก่อสร้าง", () => handClick(x), "gold"]);
    else if (d.t === "M" && d.st === "R" && !s.mu[p].R) acts.push(["ใช้ React", () => { G.castFor = x.i; draw(); }, "gold"]);
    else if (d.t === "M" && d.st === "D" && main && !s.mu[p].D) acts.push(["สวมใส่ให้ Avatar…", () => handClick(x), "gold"]);
    else if (d.t === "M" && main && !s.mu[p][d.st]) acts.push(["ใช้ Magic…", () => { G.castFor = x.i; draw(); }, "gold"]);
  }
  if (L.z === "av" && L.p === p && myMove && s.phase === "battle" && s.active === p && !s.pend && !s.trig.length && x.a) acts.push(["โจมตีด้วยใบนี้", () => { G.att = x.i; Arena.select(x.i); draw(); }, "gold"]);
  if (G.att && L.p !== p && (L.z === "av" || L.z === "cs") && myMove) acts.push(["โจมตีใบนี้", () => attack(G.att, L.z, x.i), "gold"]);
  if (G.host && L.z === "av") acts.push(["สวมใส่ให้ใบนี้", () => { const host = G.host; G.host = null; doAct({ type: "cast", i: host, on: x.i }, V); }, "gold"]);
  const sc = scriptOf(s, x); const myMain = myMove && s.active === p && s.phase === "main" && !s.trig.length && !s.pend;
  if (sc && sc.handCall && L.z === "hand" && myMain && s.P[p].hand.some((y) => y.i !== x.i && String(E.def(s, y).sy || "").includes("มังกร"))) acts.push(["ทิ้งเพื่ออัญเชิญมังกร (Cost -6)", () => { G.callVia = x.i; draw(); }, "ciel"]);
  if (sc && sc.activate && L.p === p && myMain && x.used !== s.turn && sc.activate.can(E, s, x, L)) acts.push([sc.activate.label, () => doAct({ type: "activate", i: x.i }, p), "ciel"]);
  if (E.untargetable(s, x)) acts.push(["ถูกโจมตีไม่ได้ตอนนี้", () => {}, "sm"]);
  if (mine(L.p) && d.x && L.z !== "hand" && L.z !== "deck" && !sc) acts.push(["สั่งใช้ความสามารถ", () => doAct({ type: "useAbility", i: x.i }, L.p), ""]);
  const stat = [ZONE_TH[L.z], d.t === "M" ? "Magic " + SUB_TH[d.st] : d.t === "T" ? "Token" : "Cost " + (d.c ?? 0), "GEM " + (d.g || 0) + (d.gc ? " (" + d.gc + ")" : ""), d.pw != null || L.z === "av" ? "POWER " + (L.z === "av" || L.z === "cs" ? E.power(s, x) : d.pw || 0) : null, L.z === "av" ? (x.a ? "ตื่น" : "นอน") : null, d.sy ? "Symbol " + d.sy : null].filter(Boolean);
  const api = openSheet(() => h("div", { class: "cview" }, c ? holo(h("div", { class: "ccard big", style: "cursor:default" }, artImg(c))) : h("div", { class: "fx" }, "Token " + d.n),
    h("div", { class: "stack", style: "gap:8px;min-width:0" }, h("div", { class: "row", style: "gap:6px" }, stat.map((t) => h("span", { class: "chip" + (/^POWER/.test(t) ? " gold" : "") }, t)), (x.kw || []).map((k) => h("span", { class: "chip good" }, k))),
      acts.length ? h("div", { class: "row acts" }, acts.map(([t, fn, cls]) => h("button", { class: "btn " + (cls || ""), onclick: go(fn) }, t))) : null,
      d.x ? h("div", { class: "fx" }, d.x) : h("div", { class: "muted small" }, "ไม่มีข้อความความสามารถ"))), { title: d.n, sub: s.P[L.p].name });
}
function exitGame() { const over = G && G.s && G.s.phase === "over"; stopGame(over); location.hash = "#play"; }
function turnButtons(s, p) {
  if (s.phase === "over") return [h("button", { class: "btn gold sm", onclick: () => { stopGame(true); location.hash = "#play"; } }, "กลับหน้าเตรียมเกม"), h("a", { class: "btn sm", href: "#history", onclick: () => stopGame(true) }, "ดูประวัติ")];
  if (p == null || !mine(p) || s.trig.length || s.pend || s.phase === "mull") return [];
  if (s.phase === "main") return [h("button", { class: "btn gold sm", onclick: () => doAct({ type: "battle" }, p) }, s.turn === 1 ? "จบเทิร์น" : "ไป Battle"), h("button", { class: "btn sm", onclick: () => doAct({ type: "end" }, p) }, "จบเทิร์น")];
  if (s.phase === "battle") return [h("button", { class: "btn gold sm", onclick: () => doAct({ type: "end" }, p) }, "จบเทิร์น"), G.att ? h("button", { class: "btn sm", onclick: () => { G.att = null; draw(); } }, "ยกเลิกการเลือก") : null];
  return [];
}
// desktop: big hover preview (image + readable text side by side); pinned to the selected card otherwise
function drawInspector() {
  const el = document.getElementById("insp"); if (!el || !G) return; const s = G.s;
  const hi = G.hoverHand != null ? G.hoverHand : G.hover ?? G.sel; const L = hi != null && E.locate(s, hi);
  if (!L) { el.className = "inspector glass"; el.replaceChildren(); return; }
  const x = L.x, d = E.def(s, x); const c = d.im != null ? card(d.im) : null; const pinned = G.hoverHand == null && G.hover == null;
  const stat = [L.z === "hand" ? null : ZONE_TH[L.z], d.t === "M" ? "Magic " + SUB_TH[d.st] : d.t === "T" ? "Token" : "Cost " + (d.c ?? 0), "GEM " + (d.g || 0) + (d.gc ? " (" + d.gc + ")" : ""), d.t === "A" || d.t === "T" || d.t === "C" ? "POWER " + (L.z === "av" || L.z === "cs" ? E.power(s, x) : d.pw || 0) : null, L.z === "av" ? (x.a ? "ตื่น" : "นอน") : null, d.sy ? d.sy : null].filter(Boolean);
  el.className = "inspector glass show" + (pinned ? " pinned" : "");
  el.replaceChildren(c ? artImg(c) : h("div", { class: "tok" }, "Token"),
    h("div", { class: "txt" }, h("b", null, d.n), h("div", { class: "row", style: "gap:5px" }, stat.map((t) => h("span", { class: "chip" + (/^POWER/.test(t) ? " gold" : "") }, t)), (x.kw || []).map((k) => h("span", { class: "chip good" }, k))),
      d.x ? h("div", { class: "fx" }, d.x) : h("div", { class: "muted small" }, "ไม่มีข้อความความสามารถ"),
      pinned && mine(L.p) && d.x && L.z !== "hand" ? h("button", { class: "btn sm", onclick: () => doAct({ type: "useAbility", i: x.i }, L.p) }, "สั่งใช้ความสามารถ") : null,
      pinned ? h("button", { class: "btn sm", onclick: () => { G.sel = null; Arena.select(null); drawInspector(); } }, "ปิด") : null));
}
function handZone(s, V, p) {
  const P = s.P[V]; const n = P.hand.length; const row = compact(); const zone = h("div", { class: row ? "handzone handrow" : "handzone", "aria-label": "การ์ดบนมือ" });
  const w = Math.min(760, innerWidth * 0.92); const cw = Math.round(Math.max(86, Math.min(128, innerHeight * 0.19))); const gap = Math.min(cw * 0.78, (w - cw) / Math.max(1, n - 1));
  const sel = G.pick || []; const canPlay = p != null && mine(p) && p === V;
  P.hand.forEach((x, k) => {
    const d = E.def(s, x); const off = k - (n - 1) / 2; const c = d.im != null ? card(d.im) : null;
    const b = h("button", { class: "hcard" + (sel.includes(x.i) ? " sel" : ""), "aria-label": `${d.n} ${TYPE_TH[d.t]} GEM ${d.g || 0}`, style: row ? "" : `width:${cw}px;left:${w / 2 - cw / 2 + off * gap}px;transform:translateY(${Math.abs(off) * Math.abs(off) * 2.2 + (sel.includes(x.i) ? -26 : 0)}px) rotate(${off * 3.2}deg);z-index:${k}` },
      c ? artImg(c) : null, h("span", { class: "gem" }, (d.t === "M" ? SUB_TH[d.st][0] : "C" + (d.c ?? 0)) + " · G" + (d.g || 0)),
      touchy() ? h("span", { class: "zoom", role: "button", "aria-label": "ดูการ์ด " + d.n, onclick: (e) => { e.stopPropagation(); cardView(x); } }, "⤢") : null);
    b.addEventListener("mouseenter", () => { G.hover = null; showHandInspect(x); });
    b.addEventListener("mouseleave", () => { G.hoverHand = null; drawInspector(); });
    b.addEventListener("click", () => { const sel = G.payFor || s.phase === "mull" || (s.phase === "end" && s.need) || G.host; if (touchy() && !sel) return cardView(x); handClick(x); });
    if (!canPlay) b.classList.add("dim");
    zone.append(b);
  });
  return zone;
}
function showHandInspect(x) { G.hoverHand = x.i; drawInspector(); }
function handClick(x) {
  const s = G.s, p = whoActs(s), V = view(); if (p == null || !mine(p)) return showHandInspect(x);
  const d = E.def(s, x);
  if (G.payFor) { if (x.i === G.payVia) return; const pk = G.pick || []; G.pick = pk.includes(x.i) ? pk.filter((i) => i !== x.i) : x.i === G.payFor ? pk : [...pk, x.i]; return draw(); }
  if (s.phase === "mull" || (s.phase === "end" && s.need)) { const pk = G.pick || []; G.pick = pk.includes(x.i) ? pk.filter((i) => i !== x.i) : [...pk, x.i]; return draw(); }
  if (d.t === "M" && d.st === "R") { G.castFor = x.i; return draw(); }
  if (s.active !== p || s.phase !== "main" || s.trig.length || s.pend) return showHandInspect(x);
  if (d.t === "A" && E.locked(s, p, x)) return toast("หลังใช้ซาร์อึก เกมนี้อัญเชิญได้เฉพาะมังกรหรือผู้ฝึกมังกร", "bad");
  if (d.t === "A" || d.t === "C") { const auto = E.autoPay(s, p, x.i); if (!auto) { toast(`GEM บนมือไม่พอจ่าย ${d.n} (Cost ${d.c || 0})`); return showHandInspect(x); } G.payFor = x.i; G.pick = auto; return draw(); }
  if (d.t === "M" && d.st === "D") { G.host = x.i; return draw(); }
  if (d.t === "M") { G.castFor = x.i; return draw(); } // always confirm before a Magic goes off
  showHandInspect(x);
}
function promptBox(s, p) {
  if (p == null || !mine(p)) return null; const P = s.P[p];
  const box = (title, ...kids) => h("div", { class: "prompt glass" }, h("b", { style: "font-family:var(--f-display)" }, title), ...kids);
  if (G.payFor && !(s.phase === "main" && s.active === p && !s.pend && !s.trig.length)) { G.payFor = null; G.pick = null; }
  if (G.payFor) {
    const x = P.hand.find((y) => y.i === G.payFor); if (!x) { G.payFor = null; return null; }
    const d = E.def(s, x); const cost = Math.max(0, E.costOf(s, p, x) - (G.payVia != null ? 6 : 0)); const r = E.canPay(s, p, d, G.pick || [], cost);
    const sc = scriptOf(s, x); const canCall = sc && sc.handCall && G.payVia == null && P.hand.some((y) => y.i !== x.i && String(E.def(s, y).sy || "").includes("มังกร"));
    return box(`${G.payVia != null ? "ทิ้งซาร์อึก แล้วอัญเชิญแบบจุติ" : d.t === "A" ? "อัญเชิญ" : "ก่อสร้าง"} ${d.n} · Cost ${cost}${cost !== (d.c || 0) ? ` (ปกติ ${d.c || 0})` : ""}`, h("div", { class: "small muted" }, cost ? "แตะการ์ดบนมือเพื่อเลือกจ่าย GEM (ทิ้งลงนรก) ระบบเลือกชุดที่เสียน้อยให้แล้ว" : "ไม่ต้องจ่าย GEM"),
      G.payVia != null ? h("div", { class: "small", style: "color:var(--warn)" }, "หลังจากนี้ทั้งเกม จะอัญเชิญได้เฉพาะมังกรหรือผู้ฝึกมังกร") : null,
      h("div", { class: "small " + (r.ok ? "" : "muted"), style: r.ok ? "color:#8ee3b2" : "" }, r.ok ? `จ่าย GEM ${r.total}/${cost}${r.exact ? " · พอดี" : ""}` : r.err),
      h("div", { class: "row" }, h("button", { class: "btn gold", disabled: !r.ok, onclick: () => { const pay = G.pick; const via = G.payVia; G.payFor = null; G.payVia = null; doAct({ type: d.t === "A" ? "summon" : "build", i: x.i, pay, ...(via != null ? { via } : {}) }, p); } }, "ยืนยัน"),
        canCall ? h("button", { class: "btn ciel sm", onclick: () => { G.payFor = null; G.pick = null; G.callVia = x.i; draw(); } }, "ทิ้งจากมือเพื่ออัญเชิญมังกรแทน") : null,
        h("button", { class: "btn", onclick: () => { G.payFor = null; G.payVia = null; G.pick = null; draw(); } }, "ยกเลิก")));
  }
  if (G.callVia != null) {
    const via = P.hand.find((y) => y.i === G.callVia); const drs = P.hand.filter((y) => y.i !== G.callVia && E.def(s, y).t === "A" && String(E.def(s, y).sy || "").includes("มังกร"));
    if (!via || !drs.length || !(s.phase === "main" && s.active === p)) { G.callVia = null; } else
      return box("ซาร์อึก: เลือกมังกรบนมือที่จะอัญเชิญ (Cost -6)", h("div", { class: "pick" }, drs.map((y) => cardBtn(E.def(s, y).im, { badge: "C" + Math.max(0, E.costOf(s, p, y) - 6), onclick: () => { const c = Math.max(0, E.costOf(s, p, y) - 6); G.payFor = y.i; G.payVia = via.i; G.callVia = null; G.pick = E.autoPay(s, p, y.i, c, [via.i]) || []; draw(); } }))),
        h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { G.callVia = null; draw(); } }, "ยกเลิก")));
  }
  if (G.castFor) {
    const x = P.hand.find((y) => y.i === G.castFor); const d = x && E.def(s, x);
    const ok = x && (d.st === "R" ? !s.mu[p].R : s.phase === "main" && s.active === p && !s.trig.length && !s.pend && !s.mu[p][d.st]);
    if (!ok) { G.castFor = null; } else {
      let fx = null, asks = null; try { const r = resolveEffect(s, { i: x.i, c: x.c, when: "cast", seat: p }, [], true); if (r && r.ask) asks = r.ask.prompt; else fx = r; } catch (e) { console.warn(e); } const empty = !s.P[p].av.length && /Avatar[^:]*(ฝ่ายเรา|ของเรา|Zone\s*เรา)|เลือก\s*Avatar/.test(d.x || "");
      return box(`ใช้ ${SUB_TH[d.st]} Magic: ${d.n}?`, h("div", { class: "fx small", style: "max-height:120px;overflow:auto" }, d.x || "ไม่มีข้อความ"),
        asks ? h("div", { class: "small", style: "color:#8ee3b2" }, "ใช้แล้วจะให้เลือก: " + asks) : fx ? h("div", { class: "small", style: "color:#8ee3b2" }, fx.explain) : h("div", { class: "tiny muted" }, "ระบบอ่านผลเองไม่ได้ ใช้แล้วจะให้เลือกว่าจะให้ชิเอลจัดการหรือจัดการเอง"),
        empty ? h("div", { class: "small", style: "color:var(--warn)" }, "ระวัง: ตอนนี้ยังไม่มี Avatar ฝ่ายเราบนสนาม ผลของการ์ดนี้อาจไม่มีเป้าหมาย") : null,
        s.mu[p][d.st] === undefined && d.st !== "R" ? h("div", { class: "tiny muted" }, `Magic ${SUB_TH[d.st]} ใช้ได้เทิร์นละ 1 ใบ`) : null,
        h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { G.castFor = null; doAct({ type: "cast", i: x.i }, p); } }, "ใช้เลย"), h("button", { class: "btn", onclick: () => { G.castFor = null; draw(); } }, "ยกเลิก")));
    }
  }
  if (G.host) {
    const x = P.hand.find((y) => y.i === G.host); if (!x) { G.host = null; return null; }
    const avs = [...s.P[p].av, ...s.P[1 - p].av];
    return box(`สวมใส่ ${E.name(s, x)} ให้ Avatar`, h("div", { class: "pick" }, avs.map((y) => cardBtn(E.def(s, y).im, { badge: (y.o === p ? "เรา " : "") + "P" + E.power(s, y), onclick: () => { G.host = null; doAct({ type: "cast", i: x.i, on: y.i }, p); } }))),
      h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { G.host = null; draw(); } }, "ยกเลิก")));
  }
  if (G.helperPick) {
    const hp = G.helperPick; const helpers = P.av.filter((y) => y.a && y.i !== hp.att && (E.kw(s, y, "สามัคคี") || E.kw(s, y, "แทงหลัง")));
    return box("เลือกผู้ช่วยโจมตี (สามัคคี / แทงหลัง)", h("div", { class: "pick" }, helpers.map((y) => { const b = cardBtn(E.def(s, y).im, { badge: E.kw(s, y, "สามัคคี") ? "+" + E.power(s, y) : "+1", cls: hp.sup.includes(y.i) ? "sel" : "", onclick: () => { hp.sup = hp.sup.includes(y.i) ? hp.sup.filter((i) => i !== y.i) : [...hp.sup, y.i]; draw(); } }); return b; })),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { G.helperPick = null; doAct({ type: "attack", i: hp.att, tk: hp.tk, ti: hp.ti, sup: hp.sup }, p); } }, "โจมตี"), h("button", { class: "btn", onclick: () => { G.helperPick = null; draw(); } }, "ยกเลิก")));
  }
  if (s.phase === "mull") {
    const n = (G.pick || []).length;
    return box("เปลี่ยนมือ (ทำได้ครั้งเดียว)", h("div", { class: "small muted" }, "แตะการ์ดบนมือที่ต้องการส่งกลับ Deck แล้วจั่วใหม่เท่าจำนวนนั้น"),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { const ids = G.pick || []; G.pick = null; doAct({ type: "mull", iids: ids }, p); } }, n ? `เปลี่ยน ${n} ใบ` : "เก็บมือเดิม")));
  }
  if (s.rw && s.rw.by !== p) {
    const L = E.locate(s, s.rw.i); const what = L ? `${s.rw.kind === "summon" ? "อัญเชิญ" : "ใช้ Magic"} ${E.name(s, L.x)}` : "เล่นการ์ด";
    const rs = E.reactsFor(s, p, s.rw);
    return box(`${s.P[s.rw.by].name} ${what} · จะใช้ React ตอบโต้ไหม?`, L ? h("div", { class: "row small" }, h("button", { class: "btn sm", onclick: () => cardView(L.x) }, "ดูการ์ดนั้น")) : null,
      h("div", { class: "opts" }, rs.map((x) => h("button", { class: "btn sm gold", onclick: () => doAct({ type: "cast", i: x.i }, p) }, "ใช้ " + E.name(s, x)))),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => doAct({ type: "pass" }, p) }, "ไม่ตอบโต้")));
  }
  if (s.trig.length && G.ask && G.tk === s.trig[0].id) {
    const t = s.trig[0]; const d = s.cards[t.c] || {}; const a = G.ask; const sel = G.askSel || [];
    if (a.modes) return box(`${d.n}: ${a.prompt}`, h("div", { class: "opts" }, a.modes.map((t, k) => h("button", { class: "btn sm", onclick: () => { G.tpicks[a.idx] = [k]; G.ask = null; humanTrig(G.s, p); } }, t))));
    const need = Math.min(a.n, a.options.length); const show = a.reveal || a.options;
    const okN = a.optional ? sel.length <= need : sel.length === need;
    return box(`${d.n}: ${a.prompt}`, h("div", { class: "tiny muted" }, a.reveal ? "การ์ดที่เปิดดู (ใบที่เลือกไม่ได้จะจางไว้)" : `เลือก ${need} ใบ${a.optional ? " หรือไม่เลือกก็ได้" : ""}`),
      h("div", { class: "pick" }, show.map((i) => { const L = E.locate(s, i); if (!L) return null; const dd = E.def(s, L.x); const can = a.options.includes(i);
        return cardBtn(dd.im, { cls: (sel.includes(i) ? "sel" : "") + (can ? "" : " dim"), badge: L.z === "av" || L.z === "cs" ? "P" + E.power(s, L.x) : ZONE_TH[L.z], onclick: () => { if (!can) return cardView(L.x); G.askSel = sel.includes(i) ? sel.filter((y) => y !== i) : need === 1 ? [i] : sel.length < need ? [...sel, i] : sel; draw(); } }); })),
      h("div", { class: "row" }, h("button", { class: "btn gold", disabled: !okN, onclick: () => { G.tpicks[a.idx] = G.askSel || []; G.ask = null; G.askSel = []; humanTrig(G.s, p); } }, "ยืนยัน"),
        a.optional ? h("button", { class: "btn", onclick: () => { G.tpicks[a.idx] = []; G.ask = null; G.askSel = []; humanTrig(G.s, p); } }, "ไม่เลือก") : null,
        h("button", { class: "btn sm", onclick: () => { G.ask = null; G.tmanual = true; draw(); } }, "จัดการเอง")));
  }
  if (s.trig.length && !G.tmanual && G.tk === s.trig[0].id) return box("กำลังทำงาน…", h("div", { class: "tiny muted" }, (s.cards[s.trig[0].c] || {}).n || ""));
  if (s.trig.length) {
    const t = s.trig[0]; const d = s.cards[t.c] || {}; const when = { summon: "จุติ", cast: "ใช้ Magic", life: "LIFE หงาย", death: "คำสั่งเสีย", attack: "เมื่อโจมตี", build: "ก่อสร้าง", manual: "สั่งใช้" }[t.when] || t.when;
    const hint = h("input", { type: "text", placeholder: "บอกชิเอลถ้าต้องเลือกเป้าหมาย เช่น ทำลายพญานาค", "aria-label": "เป้าหมายที่ต้องการ" }); const out = h("div");
    const auto = null;
    return box(`เอฟเฟกต์: ${d.n} (${when})`, h("div", { class: "fx small", style: "max-height:130px;overflow:auto" }, d.x || ""), Ciel.on() ? hint : null, out,
      auto ? h("div", { class: "small", style: "color:#8ee3b2" }, auto.explain) : h("div", { class: "tiny muted" }, "การ์ดนี้ซับซ้อนเกินกว่าที่ระบบอ่านเองได้ ใช้ชิเอลหรือจัดการเองด้วยเครื่องมือ"),
      h("div", { class: "row" },
        auto ? h("button", { class: "btn gold sm", onclick: () => doAct({ type: "trig", id: t.id, explain: auto.explain, ops: auto.ops }, p) }, "ใช้ผลอัตโนมัติ") : null,
        h("button", { class: "btn ciel", disabled: !Ciel.on(), title: Ciel.on() ? "" : "ต้องใส่ API key", onclick: async (e) => { const btn = e.currentTarget; btn.disabled = true; out.replaceChildren(busy("ชิเอลกำลังอ่านการ์ด…")); try { const r = await cielResolve(s, t, hint.value); out.replaceChildren(h("div", { class: "small" }, r.explain || "ไม่มีผลที่ต้องทำ"), h("div", { class: "row" }, h("button", { class: "btn gold sm", onclick: () => doAct({ type: "trig", id: t.id, ...r }, p) }, "ใช้ผลนี้"))); } catch (err) { out.replaceChildren(h("div", { class: "small muted" }, aiErr(err))); } btn.disabled = false; } }, "ให้ชิเอลจัดการ"),
        h("button", { class: "btn sm", onclick: tools }, "จัดการเอง"), h("button", { class: "btn sm", onclick: () => doAct({ type: "trig", id: t.id, skip: false, ops: [], explain: "จัดการด้วยมือแล้ว" }, p) }, "เสร็จแล้ว"), h("button", { class: "btn sm", onclick: () => doAct({ type: "trig", id: t.id, skip: true }, p) }, "ข้าม")));
  }
  if (s.pend) {
    const moves = legalMoves(s, p); const reacts = P.hand.filter((x) => { const d = E.def(s, x); return d.t === "M" && d.st === "R" && !s.mu[p].R; });
    const att = E.locate(s, s.pend.att); const tgt = s.pend.tk === "life" ? "LIFE" : (E.locate(s, s.pend.ti) || { x: null }).x ? E.name(s, E.locate(s, s.pend.ti).x) : "?";
    return box(`ถูกโจมตี: ${att ? E.name(s, att.x) : "?"} (POWER ${att ? E.power(s, att.x) + (s.pend.bonus || 0) : 0}) → ${tgt}`,
      (() => { const rs = E.reactsFor(s, p, { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti }); return rs.length ? h("div", { class: "opts" }, rs.map((x) => h("button", { class: "btn sm ciel", onclick: () => doAct({ type: "cast", i: x.i }, p) }, "React: " + E.name(s, x)))) : null; })(),
      h("div", { class: "opts" }, moves.map((m) => h("button", { class: "btn sm" + (m.a.shield ? " gold" : ""), onclick: () => doAct(m.a, p) }, m.d))));
  }
  if (s.phase === "end" && s.need) {
    const n = (G.pick || []).length;
    return box(`มือเกิน 7 ใบ · ทิ้ง ${s.need} ใบ`, h("div", { class: "row" }, h("button", { class: "btn gold", disabled: n !== s.need, onclick: () => { const ids = G.pick; G.pick = null; doAct({ type: "discard", iids: ids }, p); } }, `ทิ้ง ${n}/${s.need}`)));
  }
  if (s.phase === "battle" && s.active === p) {
    const att = s.P[p].av.filter((x) => x.a); if (!att.length) return null; const O = s.P[1 - p];
    if (!G.att) return box("เลือก Avatar ที่จะโจมตี", h("div", { class: "pick" }, att.map((x) => cardBtn(E.def(s, x).im, { badge: "P" + E.power(s, x), onclick: () => { G.att = x.i; Arena.select(x.i); draw(); } }))));
    const a = E.locate(s, G.att); if (!a) { G.att = null; return null; }
    const opts = [...O.av.map((y) => ({ t: `${E.name(s, y)} (P${E.power(s, y)})`, tk: "av", ti: y.i })), ...O.cs.map((y) => ({ t: `Construct ${E.name(s, y)} (P${E.power(s, y)})`, tk: "cs", ti: y.i }))];
    if (!O.av.length || E.kw(s, a.x, "เตะไข่")) opts.push({ t: "LIFE ฝ่ายตรงข้าม", tk: "life" });
    return box(`${E.name(s, a.x)} (P${E.power(s, a.x)}) โจมตี…`, h("div", { class: "opts" }, opts.map((o) => h("button", { class: "btn sm" + (o.tk === "life" ? " gold" : ""), onclick: () => attack(G.att, o.tk, o.ti) }, o.t))));
  }
  return null;
}
async function coach() {
  if (!Ciel.on()) { G.coach = aiErr({ code: "no_key" }); return draw(); }
  G.coach = "ชิเอลกำลังดูกระดาน…"; draw();
  try { G.coach = (await cielCoach(G.s, view())).trim(); } catch (e) { G.coach = aiErr(e); }
  draw();
}
function openPile(P, z) {
  const s = G.s; const list = z === "deck" ? [] : P[z];
  openSheet(() => z === "deck" ? h("div", { class: "muted" }, `เหลือ ${P.deck.length} ใบ (ดูลำดับไม่ได้)`) : list.length ? h("div", { class: "pick" }, list.map((x) => cardBtn(E.def(s, x).im, { onclick: () => showCard(E.def(s, x).im) }))) : h("div", { class: "empty" }, "ว่าง"), { title: `${ZONE_TH[z]} · ${P.name}`, wide: true });
}
// manual effect tools (works without Ciel)
function tools() {
  const s = G.s; const V = view(); const i = G.sel; const L = i != null && E.locate(s, i);
  const run = (ops, api) => { api.close(); doAct({ type: "op", ops }, V); };
  openSheet((api) => {
    const seatBtns = (label, op) => [V, 1 - V].map((q) => h("button", { class: "btn sm", onclick: () => run([{ ...op, seat: q }], api) }, `${label} · ${s.P[q].name}`));
    const tokName = h("input", { type: "text", placeholder: "ชื่อ Token", value: "Token", "aria-label": "ชื่อ Token" }); const tokPw = h("input", { type: "number", value: 2, style: "width:70px", "aria-label": "POWER" });
    return [h("div", { class: "small muted" }, "ใช้ทำผลของการ์ดด้วยตัวเอง ทุกอย่างบันทึกลง log"),
      h("div", { class: "eyebrow" }, "ทั่วไป"), h("div", { class: "row" }, ...seatBtns("จั่ว 1", { op: "draw", n: 1 }), ...seatBtns("ธรณีสูบ 1", { op: "mill", n: 1 }), ...seatBtns("ทิ้งสุ่ม 1", { op: "discardRandom", n: 1 }), ...seatBtns("หงาย LIFE", { op: "lifeFlip", up: true }), ...seatBtns("คว่ำ LIFE", { op: "lifeFlip", up: false })),
      h("div", { class: "row" }, tokName, tokPw, h("button", { class: "btn sm", onclick: () => run([{ op: "token", seat: V, name: tokName.value, power: +tokPw.value || 0, n: 1 }], api) }, "เรียก Token ฝั่งตัวเอง")),
      h("div", { class: "eyebrow" }, L ? `การ์ดที่เลือก: ${E.name(s, L.x)} (${ZONE_TH[L.z]})` : "แตะการ์ดบนสนามก่อน แล้วเปิดเครื่องมือนี้เพื่อจัดการใบนั้น"),
      L ? h("div", { class: "row" }, ...[["ทำลาย", { op: "destroy", i }], ["เนรเทศ", { op: "exile", i }], ["กลับขึ้นมือ", { op: "move", i, to: "hand" }], ["บนสุด Deck", { op: "move", i, to: "deckTop" }], ["POWER +1", { op: "power", i, n: 1 }], ["POWER −1", { op: "power", i, n: -1 }], ["POWER +1 ถาวร", { op: "power", i, n: 1, temp: false }], [L.x.a ? "ทำให้นอน" : "ปลุก", { op: "wake", i, v: !L.x.a }], ["ยึดควบคุม", { op: "control", i }]].map(([t, o]) => h("button", { class: "btn sm", onclick: () => run([o], api) }, t))) : null,
      h("div", { class: "eyebrow" }, "ค้นจาก Deck"), (() => { const q = h("input", { type: "text", placeholder: "คำในชื่อการ์ด", "aria-label": "ค้นจาก Deck" }); return h("div", { class: "row" }, q, h("button", { class: "btn sm", onclick: () => run([{ op: "search", seat: V, name: q.value, to: "hand" }], api) }, "ขึ้นมือ"), h("button", { class: "btn sm", onclick: () => run([{ op: "search", seat: V, name: q.value, to: "av" }], api) }, "ลงสนาม")); })(),
      h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn sm danger", onclick: () => { api.close(); confirmBox("ยอมแพ้เกมนี้?", "ยอมแพ้", () => doAct({ type: "concede" }, V), true); } }, "ยอมแพ้"))];
  }, { title: "เครื่องมือจัดการเอฟเฟกต์", wide: true });
}
