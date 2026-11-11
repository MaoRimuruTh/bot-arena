import { h, clone, toast, openSheet, confirmBox, busy, lsGet, lsSet, lsDel, newId, sleep, holo } from "../util.js?v=20261111133209";
import { fxText } from "../fxtext.js?v=20261111133209";
import { card, deckToList, validateDeck, deckAce, artImg, cardLine, TYPE_TH, SUB_TH, colorOf } from "../cards.js?v=20261111133209";
import { E, legalMoves, PHASE_TH, ZONE_TH, RuleError, scriptOf, uniqDeckActs } from "../engine.js?v=20261111133209";
import { H, Ciel, cielPick, cielResolve, cielCoach, aiErr } from "../ai.js?v=20261111133209";
import { Arena, animSetting } from "../arena3d.js?v=20261111133209";
import { myFigure, myMat, mySigil, newlyEarned, rewardName, earned, ACH } from "../achieve.js?v=20261111133209";
import { ladder, ladderReset } from "../ladder.js?v=20261111133209";
import { notify } from "../notify.js?v=20261111133209";
import { tourNow, tourPanel, newTour } from "../tour.js?v=20261111133209";
import { puzzleState, solveTurn } from "../puzzles.js?v=20261111133209";
import { autoEffect, resolveEffect } from "../effects.js?v=20261111133209";
import { Music } from "../music.js?v=20261111133209";
import { Sfx } from "../sfx.js?v=20261111133209";
import { Data, Me, F, db, gameRef, newGameId, watchLobby, watchPlaying, saveMatch, myName, myAvatar } from "../fb.js?v=20261111133209";
import { Views, cardBtn, showCard, avatarEl } from "../ui.js?v=20261111133209";
import { readAura, traits } from "../auras.js?v=20261111133209";
import { openAsk, openReport, addAskContext, isOwner } from "./ask.js?v=20261111133209";
// a readable snapshot of the game for questions asked to Ciel from inside the app
addAskContext(() => { if (!G || !G.s || !location.hash.startsWith("#play")) return null; const s = G.s, V = G.V; const me = s.P[V], op = s.P[1 - V];
  const av = (P) => P.av.map((x) => `${E.name(s, x)} P${E.power(s, x)}${x.a ? "" : " (นอน)"}`).join(", ") || "-";
  return { game: [`เทิร์น ${s.turn} · ${PHASE_TH[s.phase] || s.phase} · ตาของ ${s.P[s.active].name}`, `เด็คเรา: ${me.deckName || "-"} · เด็คคู่แข่ง: ${op.deckName || "-"}`,
    `LIFE เรา ${me.life.filter((x) => !x.up).length}/${me.life.length} · คู่แข่ง ${op.life.filter((x) => !x.up).length}/${op.life.length}`, `มือเรา: ${me.hand.map((x) => E.name(s, x)).join(", ") || "-"}`,
    `สนามเรา: ${av(me)}`, `สนามคู่แข่ง: ${av(op)}`, `Deck เรา ${me.deck.length} · นรกเรา ${me.hell.length} · มือคู่แข่ง ${op.hand.length} ใบ`, "ล่าสุด: " + s.log.slice(-8).map((l) => l.m).join(" / ")].join("\n") }; });
import { allDecks, deckById } from "./decks.js?v=20261111133209";

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
const mine = (p) => G && !G.replay && !G.watch && (G.mode === "solo" || p === G.V);

Views.play = {
  render(root, parts) {
    if (G) return G.s ? this.mountGame(root) : waitingGate(root);
    const saved = lsGet(SAVE, null);
    if (parts[0] === "deck" && parts[1]) Setup.deck = parts[1];
    this.setup(root, saved);
  },
  refresh(root, parts) { if (!G) this.render(root, parts); },
  leave() { if (this._unsubLobby) this._unsubLobby(); stopGame(false); },

  setup(root, saved) {
    if (this._unsubLobby) this._unsubLobby(); // a re-render must not leave the last lobby's listeners running
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
          h("div", { class: "row" }, h("span", { class: "small muted" }, "สมองบอท"), h("div", { class: "seg", role: "group", "aria-label": "สมองบอท" }, [["easy", "ง่าย"], ["basic", "ปกติ"], ["hard", "เก่ง"], ["ciel", "ชิเอล"]].map(([k, t]) => h("button", { "aria-pressed": Setup.brain === k ? "true" : "false", onclick: () => { Setup.brain = k; save(); draw(); } }, t)))),
          h("div", { class: "tiny muted" }, Setup.brain === "ciel" ? (Ciel.on() ? "ชิเอลคิดทุกจังหวะและอ่านเอฟเฟกต์การ์ดให้ (ใช้ API key ของคุณ)" : "ยังไม่ได้ใส่ API key จะใช้บอทระดับปกติแทน") : BOT_LEVEL[Setup.brain] ? BOT_LEVEL[Setup.brain].about : BOT_LEVEL.basic.about),
          h("button", { class: "btn gold lg", disabled: !d, onclick: () => startLocal("bot") }, "เริ่มดวล"));
      } else if (Setup.mode === "learn") {
        body.append(h("div", { class: "small" }, "เกมสอนเล่นใช้ Starter Deck 01 สู้กับบอทที่ใช้ Starter Deck 02 ระหว่างเล่นจะมีคำอธิบายขึ้นทีละเรื่องเมื่อถึงจังหวะนั้นในเกม เช่น การจ่าย GEM การโจมตี และ LIFE"),
          h("div", { class: "tiny muted" }, "กติกาตาม Rule Book 3.2 เหมือนเกมจริงทุกอย่าง ปิดคำอธิบายได้ทุกเมื่อ"),
          h("button", { class: "btn gold lg", onclick: startLearn }, "เริ่มสอนเล่น"));
      } else if (Setup.mode === "goldfish") {
        body.append(h("div", { class: "small" }, "คู่แข่งเป็นหุ่นซ้อมที่ไม่ลงการ์ดและไม่ตอบโต้เลย ใช้ดูว่าเด็คนี้ออกตัวได้แค่ไหนและชนะได้เร็วสุดเทิร์นไหน"),
          h("div", { class: "tiny muted" }, "เราเล่นก่อนทุกเกม ผลจะเก็บแยกในประวัติ ไม่นับรวมอัตราชนะ และย้อนตาได้"),
          h("button", { class: "btn gold lg", disabled: !d, onclick: () => startLocal("goldfish") }, "เริ่มซ้อม"));
      } else if (Setup.mode === "puzzle") {
        const list = h("div", { class: "stack", style: "gap:8px" }, busy("กำลังโหลดโจทย์…"));
        body.append(h("div", { class: "small" }, "ตำแหน่งจากเกมจริงระหว่างบอท ถึงตาเราแล้ว คู่แข่งไม่มีการ์ดบนมือ หาทางชนะให้ได้ก่อนจบเทิร์นนี้ ทุกโจทย์มีทางชนะแน่นอนไม่ว่าคู่แข่งจะป้องกันแบบไหน"),
          h("div", { class: "tiny muted" }, "ย้อนตาได้ไม่จำกัด และกดคำใบ้ให้ชิเอลคิดก้าวต่อไปจากตำแหน่งตอนนั้นได้"), list);
        loadPuzzles().then((PZ) => { const done = lsGet(PZ_DONE, {});
          list.replaceChildren(...PZ.map((pz, k) => h("div", { class: "mrow", style: "cursor:default" }, h("span", { class: "chip " + (done[pz.id] ? "good" : "") }, done[pz.id] ? "✓" : String(k + 1)),
            h("div", { class: "grow" }, h("b", null, `โจทย์ที่ ${k + 1}` + (pz.hard ? " · ยาก" : "")), h("div", { class: "tiny muted" }, `ทางชนะสั้นสุด ${pz.len} ขั้น · ${pz.down ? `คู่แข่งเหลือ LIFE คว่ำ ${pz.down} ใบ` : "คู่แข่งอยู่ในสถานะสาหัส"} · ${pz.state.P[pz.p].deckName}`)),
            h("button", { class: "btn sm " + (done[pz.id] ? "" : "gold"), onclick: () => startPuzzle(pz, k) }, done[pz.id] ? "เล่นอีก" : "เริ่ม")))); })
          .catch(() => list.replaceChildren(h("div", { class: "muted small" }, "โหลดโจทย์ไม่ได้")));
      } else if (Setup.mode === "solo") {
        body.append(h("div", { class: "row" }, h("span", { class: "small muted" }, "เด็คฝั่งที่ 2"), deckSel("opp", decks, h("option", { value: "random", selected: Setup.opp === "random" }, "สุ่มจาก Starter Deck"))),
          h("div", { class: "tiny muted" }, "ควบคุมทั้งสองฝั่งเอง เหมาะกับลองคอมโบหรือเล่นกับเพื่อนบนเครื่องเดียวกัน"), h("button", { class: "btn gold lg", disabled: !d, onclick: () => startLocal("solo") }, "เริ่มเกม"));
      } else {
        const lobby = h("div", { class: "stack", style: "gap:8px" }, busy("กำลังหาห้อง…")); let seenRooms = null;
        lobbyUnsub = watchLobby((rooms) => {
          const list = rooms.filter((r) => Date.now() - (r.updatedAt || 0) < 6 * 3600e3).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          if (seenRooms) for (const r of list) if (!seenRooms.has(r.id) && r.host !== Me.uid) notify("มีห้องรอดวล", `${r.hostName || "เพื่อน"} สร้างห้องด้วยเด็ค ${(r.hostDeck && r.hostDeck.name) || ""}`, "bot-room");
          seenRooms = new Set(list.map((r) => r.id));
          lobby.replaceChildren(...(list.length ? list.map((r) => h("div", { class: "mrow", style: "cursor:default" }, avatarEl(r.hostAva, r.hostName), h("div", { class: "grow" }, h("b", null, r.hostName || "เพื่อน"), h("div", { class: "tiny muted" }, (r.tour ? `แมตช์ทัวร์กับ ${r.vsName || "เพื่อน"} · ` : r.vs ? `ท้าดวล ${r.vsName || "เพื่อน"} · ` : "") + "เด็ค " + (r.hostDeck && r.hostDeck.name || ""))),
            r.host === Me.uid ? h("button", { class: "btn sm danger", onclick: () => F.deleteDoc(gameRef(r.id)).catch(() => {}) }, "ยกเลิกห้อง")
              : r.vs && r.vs !== Me.uid ? h("span", { class: "tiny muted" }, "รอ " + (r.vsName || "เพื่อน")) : h("button", { class: "btn sm gold", disabled: !d, onclick: () => joinRoom(r) }, "เข้าร่วม"))) : [h("div", { class: "muted small" }, "ยังไม่มีห้องที่รออยู่")]));
        });
        // games in progress: watch a friend's (hands stay hidden), or get back into your own from this device
        const live = h("div", { class: "stack", style: "gap:8px" }); const u1 = lobbyUnsub;
        const u2 = watchPlaying((games) => {
          const list = games.filter((g) => Date.now() - (g.updatedAt || 0) < 3 * 3600e3).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          const left = (Q) => 5 - Q.life.filter((x) => x.up).length;
          const rows = list.map((g) => {
            let st = null; try { st = JSON.parse(g.state); } catch { /* not started */ } if (!st) return null;
            const [A, B] = st.P; const seat = (g.seats || []).indexOf(Me.uid);
            return h("div", { class: "mrow", style: "cursor:default" }, h("div", { class: "vsava" }, avatarEl(A.ava, A.name, "sm"), avatarEl(B.ava, B.name, "sm")),
              h("div", { class: "grow" }, h("b", null, `${A.name} กับ ${B.name}`), h("div", { class: "tiny muted" }, `${st.turn ? "เทิร์น " + st.turn : "เพิ่งเริ่ม"} · LIFE เหลือ ${left(A)} ต่อ ${left(B)} · ${A.deckName} กับ ${B.deckName}`)),
              seat >= 0 ? h("button", { class: "btn sm gold", onclick: () => openOnline(g.id, seat) }, "กลับเข้าเกม") : h("button", { class: "btn sm", onclick: () => openOnline(g.id, 0, true) }, "ดู"));
          }).filter(Boolean);
          live.replaceChildren(...(rows.length ? rows : [h("div", { class: "muted small" }, "ตอนนี้ยังไม่มีใครเล่นอยู่")]));
        });
        lobbyUnsub = () => { u1(); u2(); };
        const rankLine = h("div", { class: "tiny muted" }), tourBox = h("div"), tour = tourNow();
        if (tour) ladder().then((L) => tourBox.replaceChildren(tourPanel(tour, L, (opp) => (d ? createRoom({ tour: tour.id, vs: opp.uid, vsName: opp.name }) : toast("เลือกเด็คก่อน"))))).catch(() => {});
        else if (isOwner()) tourBox.replaceChildren(h("button", { class: "btn sm", onclick: newTour }, "จัดทัวร์นาเมนต์ในกลุ่มเพื่อน"));
        ladder().then((L) => { const k = L.table.findIndex((p) => p.uid === Me.uid); if (k >= 0) rankLine.textContent = `อันดับในกลุ่มเพื่อน: ที่ ${k + 1} จาก ${L.table.length} · ${L.table[k].r} แต้ม (ดูทั้งหมดในหน้าประวัติ)`; }).catch(() => {});
        body.append(h("div", { class: "tiny muted" }, "สร้างห้องแล้วให้เพื่อนที่ได้รับอนุมัติกดเข้าร่วมจากหน้านี้ เกมซิงก์ผ่านฐานข้อมูลแบบเรียลไทม์"),
          h("button", { class: "btn gold lg", disabled: !d, onclick: () => createRoom() }, "สร้างห้อง"), rankLine, tourBox, h("div", { class: "eyebrow" }, "ห้องที่รออยู่"), lobby,
          h("div", { class: "eyebrow" }, "กำลังเล่นอยู่"), live, h("div", { class: "tiny muted" }, "กดดูเกมของเพื่อนได้ ผู้ชมเห็นสนามและบันทึกเกมเหมือนผู้เล่น แต่มองไม่เห็นการ์ดบนมือของทั้งสองฝั่ง"));
      }
      right.replaceChildren(h("div", { class: "modes" }, modeBtn("bot", "ดวลกับบอท", "ซ้อมมือกับชิเอล"), modeBtn("friend", "ดวลกับเพื่อน", "ออนไลน์ผ่านห้อง"), modeBtn("solo", "เล่นสองฝั่ง", "ทดลองคอมโบเอง"), modeBtn("goldfish", "ซ้อมมือเดียว", "วัดว่าเด็คชนะเร็วแค่ไหน"), modeBtn("puzzle", "โจทย์ปริศนา", "หาทางชนะในเทิร์นเดียว"), modeBtn("learn", "สอนเล่น", "เรียนกติกาทีละขั้น")), h("div", { class: "panel" }, body));
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
    try { Arena.mount(stage, { mat: myMat(), watch: !!G.watch }); } catch (e) { console.warn("3D off", e); }
    Arena.setHover((i) => { if (G.hover === i) return; G.hover = i; drawInspector(); });
    Arena.setClick(fieldClick);
    Arena.update(G.s, view(), { reset: true });
    Music.start(); draw(); drive();
    if (G.mode === "friend") { clearInterval(G.idleTick); const g = G; G.idleTick = setInterval(() => { if (G !== g) return clearInterval(g.idleTick); const idle = oppIdle() > IDLE_MS; if (idle !== !!G.idleShown) { G.idleShown = idle; draw(); } }, 5000); }
  },
};

// ---------- start / resume ----------
const pickOpp = () => { if (Setup.opp !== "random") return deckById(Setup.opp); const st = allDecks().filter((d) => d.starter); return st[Math.floor(Math.random() * st.length)]; };
const pack = (d) => ({ ...deckToList(d), name: d.name, id: d.id });
function startLocal(mode) {
  // goldfish (ซ้อมมือเดียว): the other side is a training dummy that never plays a card, so the game shows how fast this deck can win
  const fish = mode === "goldfish"; const me = deckById(Setup.deck), op = fish ? me : pickOpp(); if (!me || !op) return toast("เลือกเด็คก่อน");
  const botName = Setup.brain === "ciel" && Ciel.on() ? "ชิเอล" : (BOT_LEVEL[Setup.brain] || BOT_LEVEL.basic).name;
  const init = { players: [{ uid: Me.uid, name: myName(), ava: myAvatar(), av3: myFigure(), sig: mySigil() }, fish ? { name: "หุ่นซ้อม", bot: true } : mode === "bot" ? { name: botName, bot: true, av3: myFigure() ? "chang" : "" } : { uid: Me.uid, name: "ฝั่งที่ 2" }], decks: [pack(me), pack(op)], seed: (Math.random() * 2 ** 31) | 0, first: fish ? 0 : Math.random() < 0.5 ? 0 : 1, mode: fish ? "bot" : mode };
  const s = E.newGame(init);
  G = { s, V: 0, mode: fish ? "bot" : mode, fish, brain: fish ? "goldfish" : mode !== "bot" ? "basic" : Setup.brain === "ciel" ? (Ciel.on() ? "ciel" : "basic") : BOT_LEVEL[Setup.brain] ? Setup.brain : "basic", id: s.id, saved: false, rec: { init: { ...init, id: s.id }, acts: [] } };
  persist(); go();
}
function startLearn() {
  const st = allDecks().filter((d) => d.starter); const me = st.find((d) => /01/.test(d.name)) || st[0], op = st.find((d) => /02/.test(d.name)) || st[1]; if (!me || !op) return toast("ไม่พบ Starter Deck");
  const init = { players: [{ uid: Me.uid, name: myName(), ava: myAvatar(), av3: myFigure(), sig: mySigil() }, { name: "บอท", bot: true, av3: myFigure() ? "chang" : "" }], decks: [pack(me), pack(op)], seed: 20261111, first: 0, mode: "bot" };
  const s = E.newGame(init);
  G = { s, V: 0, mode: "bot", brain: "basic", id: s.id, saved: false, learn: { seen: {} }, rec: { init: { ...init, id: s.id }, acts: [] } };
  persist(); go();
}
function go() { if (location.hash === "#play/game") Views.play.render(document.getElementById("view"), ["game"]); else location.hash = "#play/game"; }
function waitingGate(root) {
  const id = G.id;
  root.replaceChildren(h("div", { class: "gate" }, h("div", { class: "stack", style: "align-items:center" }, busy(G.V === 0 && !G.watch ? "รอเพื่อนเข้าร่วมห้อง…" : "กำลังเชื่อมต่อ…"), h("button", { class: "btn", onclick: () => { if (G && G.V === 0 && !G.watch) F.deleteDoc(gameRef(id)).catch(() => {}); stopGame(true); location.hash = "#play"; } }, "ยกเลิก"))));
}
function resume(saved) {
  G = { ...saved, saved: false };
  if (G.mode === "friend") return openOnline(G.id, G.V);
  go();
}
function persist() { if (!G || G.replay || G.watch) return; if (G.mode === "friend") lsSet(SAVE, { mode: "friend", id: G.id, V: G.V, s: G.s }); else lsSet(SAVE, { s: G.s, V: G.V, mode: G.mode, brain: G.brain, id: G.id, learn: G.learn || null, rec: G.rec || null, puzzle: G.puzzle || null }); }
function stopGame(clear) {
  if (!G) return; if (G.unsub) G.unsub(); if (clear) { if (!G.watch) lsDel(SAVE); } else persist(); // a watcher never touches their own saved game
  if (G.mode === "friend" && !G.watch && G.s && G.s.phase === "over") trimGame(G.id, G.s);
  clearInterval(G.idleTick); Arena.unmount(); Music.stop(); document.body.classList.remove("arena-on"); document.querySelectorAll(".banner,.dmg,.emo").forEach((e) => e.remove()); G = null;
}
// ---------- friends ----------
async function createRoom(extra = {}) { // extra: a tournament match ({ tour, vs, vsName }) only that friend may join
  const me = deckById(Setup.deck); if (!me) return;
  const id = newGameId();
  await F.setDoc(gameRef(id), { status: "waiting", host: Me.uid, hostName: myName(), hostAva: myAvatar(), hostAv3: myFigure(), hostSig: mySigil(), hostDeck: pack(me), seats: [Me.uid], createdAt: Date.now(), updatedAt: Date.now(), ...extra });
  toast("สร้างห้องแล้ว รอเพื่อนเข้าร่วม"); openOnline(id, 0);
}
async function joinRoom(r) {
  const me = deckById(Setup.deck); if (!me) return;
  try {
    await F.runTransaction(db, async (tx) => {
      const snap = await tx.get(gameRef(r.id)); const g = snap.data(); if (!g || g.status !== "waiting") throw new Error("ห้องนี้เริ่มไปแล้ว"); if (g.vs && g.vs !== Me.uid) throw new Error("ห้องนี้เป็นแมตช์ทัวร์ของเพื่อนคนอื่น");
      const s = E.newGame({ players: [{ uid: g.host, name: g.hostName, ava: g.hostAva || "", av3: g.hostAv3 || "", sig: g.hostSig || "" }, { uid: Me.uid, name: myName(), ava: myAvatar(), av3: myFigure(), sig: mySigil() }], decks: [g.hostDeck, pack(me)], seed: (Math.random() * 2 ** 31) | 0, first: Math.random() < 0.5 ? 0 : 1, mode: "friend", id: r.id });
      tx.update(gameRef(r.id), { status: "playing", guest: Me.uid, guestName: myName(), seats: [g.host, Me.uid], state: JSON.stringify(s), updatedAt: Date.now() });
    });
    openOnline(r.id, 1);
  } catch (e) { toast(e.message || "เข้าร่วมไม่ได้", "bad"); }
}
// rematch with the same friend: open a room only they may join, and leave a note on the finished game for them
async function friendRematch() {
  const g = G, s = g.s, V = g.V, opp = s.P[1 - V]; const deck = deckById(s.P[V].deckId) || deckById(Setup.deck); if (!deck) return toast("เลือกเด็คก่อน");
  const id = newGameId();
  try { await F.setDoc(gameRef(id), { status: "waiting", host: Me.uid, hostName: myName(), hostAva: myAvatar(), hostAv3: myFigure(), hostSig: mySigil(), hostDeck: pack(deck), seats: [Me.uid], createdAt: Date.now(), updatedAt: Date.now(), vs: opp.uid, vsName: opp.name });
    await F.updateDoc(gameRef(g.id), { rematch: { id, by: V } }); } catch { return toast("เปิดห้องไม่ได้", "bad"); }
  stopGame(true); openOnline(id, 0); toast(`เปิดห้องแล้ว รอ ${opp.name} รับคำท้า`);
}
function acceptRematch() { const id = G && G.offer; if (!id) return; stopGame(true); joinRoom({ id }); }
function openOnline(id, V, watch) {
  G = { s: null, V, mode: "friend", id, saved: !!watch, waiting: true, watch: !!watch };
  go();
  G.unsub = F.onSnapshot(gameRef(id), (snap) => {
    if (!G) return; const g = snap.data();
    if (!g) { toast("ห้องถูกปิดแล้ว"); stopGame(true); location.hash = "#play"; return; }
    G.updatedAt = g.updatedAt || G.updatedAt;
    G.emoSeen = G.emoSeen || {};
    for (const p of [0, 1]) { const e = g["emo" + p]; if (e && e.at > (G.emoSeen[p] || 0)) { G.emoSeen[p] = e.at; if ((G.watch || p !== G.V) && Date.now() - e.at < 15000 && G.s) showEmote(p, e.k); } }
    if (g.rematch && g.rematch.by !== G.V && !G.watch && G.offer !== g.rematch.id) { G.offer = g.rematch.id; notify("เพื่อนขอดวลอีกครั้ง", `${G.s ? G.s.P[g.rematch.by].name : "เพื่อน"} เปิดห้องรอแล้ว`, "bot-game"); toast("เพื่อนขอดวลอีกครั้ง"); draw(); }
    if (!g.state) { G.sawWaiting = true; return; } if (g.trimmed || g.state === G.lastState) return; G.lastState = g.state;
    const s = JSON.parse(g.state); const first = !G.s, was = G.s; G.s = s; persist();
    if (!G.watch) heads(was, s);
    if (first) Views.play.mountGame(document.getElementById("view")); else { Arena.update(s, view()); draw(); drive(); }
  }, (e) => { console.warn(e); toast("เชื่อมต่อห้องไม่ได้", "bad"); });
}

// a notice when something needs you while the app is in the background (see notify.js)
function heads(was, s) {
  const V = G.V, op = s.P[1 - V].name;
  if (!was) { if (G.sawWaiting) notify("เพื่อนเข้าห้องแล้ว", `${op} เข้าร่วมแล้ว เริ่มเกมได้เลย`, "bot-game"); return; }
  if (s.phase === "over") { if (was.phase !== "over") notify(s.winner === V ? "คุณชนะ!" : s.winner == null ? "เกมเสมอ" : "เกมจบแล้ว", s.reason || "", "bot-game"); return; }
  const p = whoActs(s); if (p !== V || whoActs(was) === V || (s.pend && nothingToAnswer(s, V))) return;
  notify("ถึงตาคุณแล้ว", s.phase === "mull" ? "เลือกเปลี่ยนการ์ดบนมือ" : s.pend ? `${op} โจมตี เลือกการตอบโต้` : s.active === V ? `เทิร์น ${s.turn} ของคุณ` : "มีเอฟเฟกต์ให้เลือก", "bot-game");
}
// ---------- watching a friend's game: the same table, read only, both hands face down ----------
function flipWatch() { if (!G || !G.watch || !G.s) return; G.V = 1 - G.V; G.pcMe = G.pcOp = undefined; G.sel = G.hover = null; Arena.update(G.s, G.V, { reset: true, flush: true }); draw(); }
const watchHand = (P) => h("div", { class: "watchhand glass", "aria-label": `มือของ ${P.name} ${P.hand.length} ใบ` }, h("span", { class: "small" }, `มือของ ${P.name}`), h("div", { class: "backs" }, P.hand.slice(0, 12).map(() => h("i"))), h("b", null, P.hand.length));
// ---------- emotes: short friendly lines, shown by the player who sent them (and the little 3D figure hops) ----------
const EMOTES = [["hi", "สวัสดี 👋"], ["glhf", "ขอให้สนุกนะ"], ["wow", "ว้าว!"], ["gg", "เก่งมาก!"], ["oops", "อุ๊ย!"], ["think", "ขอคิดแป๊บ 🤔"], ["ty", "ขอบคุณนะ"], ["ggwp", "GG เกมดี!"]];
const EMO_TH = Object.fromEntries(EMOTES);
const BOT_REPLY = { hi: "hi", glhf: "glhf", gg: "ty", ty: "hi", ggwp: "ggwp", wow: "ty" }; // the bot answers a greeting or a compliment
function sendEmote(k) {
  if (!G || !G.s || G.replay) return; const now = Date.now(); if (now - (G.emoAt || 0) < 2500) return toast("รอแป๊บค่อยส่งอีกนะ"); G.emoAt = now;
  showEmote(G.V, k);
  if (G.mode === "friend") F.updateDoc(gameRef(G.id), { ["emo" + G.V]: { k, at: now } }).catch(() => {});
  else if (G.mode === "bot" && !G.fish && BOT_REPLY[k]) { const g = G; setTimeout(() => G === g && showEmote(1 - g.V, BOT_REPLY[k]), 1300); }
}
function showEmote(p, k) {
  if (!G || !EMO_TH[k]) return; const mine = p === G.V; if (!mine && lsGet("bot.muteEmo", false)) return;
  const anchor = document.querySelector(mine ? (compact() ? ".mbar" : ".meplate") : ".oppbar"); if (!anchor) return;
  const r = anchor.getBoundingClientRect(); document.querySelectorAll(".emo." + (mine ? "me" : "op")).forEach((e) => e.remove());
  const el = h("div", { class: "emo glass " + (mine ? "me" : "op"), role: "status" }, h("b", null, G.s.P[p].name), " ", EMO_TH[k]);
  el.style.left = Math.max(8, Math.min(innerWidth - 220, r.left + 12)) + "px"; el.style.top = (mine ? r.top - 46 : r.bottom + 8) + "px"; document.body.append(el);
  Arena.cheer(p); Sfx.play("click");
  if (window.gsap) window.gsap.fromTo(el, { y: mine ? 8 : -8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25, ease: "back.out(2)" });
  setTimeout(() => { if (window.gsap) window.gsap.to(el, { opacity: 0, duration: 0.4, onComplete: () => el.remove() }); else el.remove(); }, 3200);
}
function emotePicker() {
  openSheet((api) => [h("div", { class: "emogrid" }, EMOTES.map(([k, t]) => h("button", { class: "btn", onclick: () => { api.close(); sendEmote(k); } }, t))),
    G.mode !== "bot" ? h("label", { class: "row small muted" }, h("input", { type: "checkbox", checked: lsGet("bot.muteEmo", false), onchange: (e) => lsSet("bot.muteEmo", e.target.checked) }), "ไม่แสดงอีโมตของคู่แข่ง") : null],
    { title: "ส่งอีโมต", sub: G.mode === "friend" ? "เพื่อนจะเห็นข้อความนี้ทันที" : "บอทอาจตอบกลับ" });
}
// leaving a finished friend game shrinks it to who played and who won (the summary below stays), so the friends'
// ladder never has to download whole games; whoever is still looking at the final table keeps their copy
function trimGame(id, s) {
  const tiny = JSON.stringify({ phase: "over", winner: s.winner, reason: s.reason, turn: s.turn, P: s.P.map((P) => ({ uid: P.uid, name: P.name, ava: P.ava, deckName: P.deckName })) });
  F.updateDoc(gameRef(id), { state: tiny, trimmed: true }).catch(() => {});
}
// a finished friend game carries a small summary, so the friends' ladder can be worked out without unpacking every game
const overSummary = (s) => (s.phase !== "over" ? {} : { result: { w: s.winner == null ? "" : s.P[s.winner].uid || "", seats: [s.P[0].uid || "", s.P[1].uid || ""], names: [s.P[0].name, s.P[1].name], turns: s.turn, at: Date.now() } });
// online: when the other side has made no move for a while on their own decision, the waiting player may claim the game
const IDLE_MS = 4 * 60e3;
const oppIdle = () => { if (!G || G.mode !== "friend" || G.watch || !G.s || G.s.phase === "over") return 0; const p = whoActs(G.s); if (p == null || p === G.V) return 0; return Math.max(0, Date.now() - (G.updatedAt || Date.now())); };
async function claimIdle() {
  const V = G.V;
  try { await F.runTransaction(db, async (tx) => { const snap = await tx.get(gameRef(G.id)); const g = snap.data(); if (Date.now() - (g.updatedAt || 0) < IDLE_MS) throw new Error("คู่แข่งเพิ่งเล่น"); const s = JSON.parse(g.state); if (s.phase === "over") return;
    E.lose(s, 1 - V, `${s.P[1 - V].name} ไม่ได้เล่นนานเกิน 4 นาที`); tx.update(gameRef(G.id), { state: JSON.stringify(s), status: "over", ...overSummary(s), updatedAt: Date.now() }); }); }
  catch (e) { toast(e.message || "ทำไม่ได้", "bad"); }
}

// ---------- actions ----------
const view = () => (G.mode === "solo" ? (whoActs(G.s) ?? G.s.active) : G.V);
async function doAct(a, p) {
  if (!G || G.lock) return false;
  if (G.mode === "friend") {
    G.lock = true;
    try {
      await F.runTransaction(db, async (tx) => { const snap = await tx.get(gameRef(G.id)); const s = JSON.parse(snap.data().state); E.apply(s, a, p); tx.update(gameRef(G.id), { state: JSON.stringify(s), status: s.phase === "over" ? "over" : "playing", ...overSummary(s), updatedAt: Date.now() }); });
      G.pick = null; G.att = null; G.host = null; G.payFor = null; G.payVia = null; G.callVia = null; G.castFor = null; return true;
    } catch (e) { toast(e.message || "ทำไม่ได้", "bad"); return false; }
    finally { if (G) G.lock = false; }
  }
  const fromHand = a.i != null && /^(summon|cast|build)$/.test(a.type) && G.s.P[view()].hand.some((x) => x.i === a.i);
  const copy = G.rec ? JSON.parse(JSON.stringify(a)) : null;
  try { E.apply(G.s, a, p); } catch (e) { toast(e.message, "bad"); return false; }
  if (G.rec) G.rec.acts.push([p, copy]);
  if (G.puzzle && mine(p)) G.say = null; // an old hint no longer fits
  if (fromHand) flyFromHand(a.i);
  G.pick = null; G.att = null; G.host = null; G.payFor = null; G.payVia = null; G.callVia = null; G.helperPick = null; G.castFor = null; persist();
  Arena.update(G.s, view()); draw(); drive();
  return true;
}
// a card played from the hand leaves it visibly, lifting toward the table where the 3D card takes over
function flyFromHand(i) {
  const el = document.querySelector(`.hcard[data-i="${i}"]`); if (!el || !window.gsap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = el.getBoundingClientRect(), c = el.cloneNode(true);
  Object.assign(c.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: "0", transform: "none", zIndex: "60", pointerEvents: "none" });
  document.body.append(c);
  window.gsap.to(c, { y: -Math.min(240, r.top * 0.45), scale: 0.72, opacity: 0, duration: 0.4, ease: "power2.in", onComplete: () => c.remove() });
}
// attacked with nothing to answer with (no awake โล่มนุษย์, no React that fits): take the attack without asking
function nothingToAnswer(s, p) { return !!s.pend && s.pend.by !== p && !s.trig.length && !s.rw && legalMoves(s, p).length <= 1 && !E.reactsFor(s, p, { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti }).length; }
function autoRespond(s, p) {
  if (!mine(p) || !nothingToAnswer(s, p) || G.castFor) return;
  const key = [s.turn, s.pend.att, s.pend.tk, s.pend.ti, s.log.length].join(":"); if (G.autoKey === key) return; G.autoKey = key;
  setTimeout(() => { const n = G && G.s; if (!n || !n.pend || G.castFor || [n.turn, n.pend.att, n.pend.tk, n.pend.ti, n.log.length].join(":") !== key || !nothingToAnswer(n, p)) return; doAct((legalMoves(n, p)[0] || {}).a || { type: "respond" }, p); }, 900);
}
// bot levels: how many promising moves it plays out on a copy before choosing (more = stronger and slower), and how often
// the easy one just does something at random. In 24-game tests hard beat normal 15-9 and normal beat easy 19-5.
const BOT_LEVEL = { easy: { name: "บอทมือใหม่", look: 0, rnd: 0.35, about: "บอทมือใหม่ เล่นถูกกติกาแต่ตัดสินใจไม่ค่อยดี บางทีก็มั่ว และไม่ใช้ React" },
  basic: { name: "บอท", look: 4, rnd: 0, about: "บอทระดับปกติ คิดล่วงหน้าหนึ่งจังหวะ ข้ามเอฟเฟกต์ข้อความของตัวเอง" },
  hard: { name: "บอทมือโปร", look: 8, rnd: 0, about: "บอทมือโปร ลองเล่นตาที่น่าสนใจล่วงหน้ามากขึ้นก่อนเลือก และเมื่อเรา LIFE เหลือน้อยจะค้นหาทางปิดเกมให้จบในเทิร์นเดียว" } };
// bot / auto driver
async function drive() {
  if (!G || G.driving || !G.s || G.replay) return; const s = G.s;
  if (s.phase === "over") return finish();
  if (G.watch) return; // watching: nothing here acts for either side
  if (G.puzzle && s.active !== G.V) { if (!G.pzFail) { G.pzFail = true; draw(); } return; } // a puzzle is lost once the turn passes
  const p = whoActs(s); if (p == null) return;
  if (!isBot(s, p)) { if (s.trig.length && mine(p)) humanTrig(s, p); else autoRespond(s, p); return; }
  G.driving = true;
  try {
    await Arena.idle(); await sleep((G.brain === "ciel" ? 250 : 650) / animSetting()); if (!G || G.s !== s) return;
    let a = null; const lv = BOT_LEVEL[G.brain]; if (lv) H.look = lv.look;
    if (G.brain === "goldfish" && !s.trig.length && !(s.phase === "end" && s.need)) a = s.phase === "mull" ? { type: "mull", iids: [] } : s.rw ? { type: "pass" } : s.pend ? { type: "respond" } : { type: "end" }; // the dummy keeps its hand and never answers
    else if (s.phase === "mull") a = { type: "mull", iids: G.brain === "easy" ? [] : H.mulligan(s, p) };
    else if (s.rw) a = (G.brain === "easy" ? null : H.react(s, p)) || { type: "pass" };
    else if (s.trig.length) {
      const t = s.trig[0];
      if (G.brain === "ciel") { G.thinking = "ชิเอลกำลังอ่านเอฟเฟกต์ " + (s.cards[t.c] || {}).n; draw(); try { const r = await cielResolve(s, t); a = { type: "trig", id: t.id, ...r }; } catch (e) { a = H.trig(s, t); toast(aiErr(e), "bad"); } }
      else a = H.trig(s, t);
    } else if (s.phase === "end" && s.need) a = { type: "discard", iids: H.discard(s, p) };
    else {
      let m = null;
      const rx = s.pend && G.brain !== "easy" ? H.react(s, p) : null;
      if (rx) m = { a: rx, say: "ใช้ React ตอบโต้!" };
      else if (lv && lv.rnd && !s.pend && Math.random() < lv.rnd) { const ms = legalMoves(s, p).filter((x) => x.a.type !== "concede"); if (ms.length) m = ms[Math.floor(Math.random() * ms.length)]; }
      else if (G.brain === "ciel") { G.thinking = "ชิเอลกำลังคิด…"; draw(); m = lethalMove(s, p) || (await cielPick(s, p)); }
      else m = (G.brain === "hard" && lethalMove(s, p)) || H.pick(s, p);
      if (m && m.say) G.say = m.say;
      a = m ? m.a : s.pend ? { type: "respond" } : { type: "end" };
    }
    G.thinking = null; if (!G || G.s !== s) return;
    G.driving = false;
    if (!(await doAct(a, p))) { try { E.apply(G.s, { type: "end" }, p); if (G.rec) G.rec.acts.push([p, { type: "end" }]); } catch { E.lose(G.s, p, "บอทติดสถานะ"); if (G.rec) G.rec.acts.push([p, { type: "__lose", reason: "บอทติดสถานะ" }]); } Arena.update(G.s, view()); draw(); }
  } finally { if (G) G.driving = false; H.look = BOT_LEVEL.basic.look; }
}
// the pro bot (and Ciel) look for a win this very turn once the other side is low on LIFE, the same search the puzzles
// use, on a copy without the other side's hand (no peeking at React cards) and with its own Deck shuffled
function lethalMove(s, p) {
  if (s.pend || s.trig.length || s.rw || s.active !== p || !["main", "battle"].includes(s.phase) || s.P[1 - p].life.filter((x) => !x.up).length > 2) return null;
  const k = s.turn + ":" + p; if (G.noLethal === k) return null; // already searched this turn and found nothing
  const t = JSON.parse(JSON.stringify({ ...s, cards: null, log: [], ev: [] })); t.cards = s.cards; t.P[1 - p].hand = []; E.shuffle(t, t.P[p].deck);
  let r = null; try { r = solveTurn(t, p, 7, 6000); } catch { /* too big to finish */ }
  if (r && r.line && r.line.length) return { a: r.line[0].a, say: "เห็นทางชนะในเทิร์นนี้แล้ว!" };
  G.noLethal = k; return null;
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
  if (G.puzzle) { // puzzles stay out of the history; solving enough of them opens the gold-leaf mat
    if (s.winner === G.V) { const before = earned(); const d = lsGet(PZ_DONE, {}); d[G.puzzle.id] = d[G.puzzle.id] || Date.now(); lsSet(PZ_DONE, d); const now = earned(); const fresh = ACH.filter((a) => now.has(a.id) && !before.has(a.id)); if (fresh.length) setTimeout(() => celebrate(fresh), 1800); }
    lsDel(SAVE); draw(); return; }
  const seats = G.mode === "solo" ? [] : [G.V];
  for (const V of seats) {
    const P = s.P[V], O = s.P[1 - V]; const rp = keepReplay(s.id + "-" + V);
    const rec = { id: s.id + "-" + V, mode: G.fish ? "goldfish" : G.mode, brain: G.brain || null, lifeLost: P.life.filter((x) => x.up).length, deckId: P.deckId, result: s.winner === V ? "win" : s.winner == null ? "draw" : "loss", turns: s.turn };
    const fresh = newlyEarned(rec); if (fresh.length) setTimeout(() => celebrate(fresh), 1800); // what this game unlocked
    saveMatch(s.id + "-" + V, { rp: rp ? 1 : 0, undo: G.undos || 0, brain: rec.brain, lifeLost: rec.lifeLost, uid: Me.uid, mode: G.fish ? "goldfish" : G.mode, deckId: P.deckId, deckName: P.deckName, opp: O.name, oppDeck: O.deckName, result: s.winner === V ? "win" : s.winner == null ? "draw" : "loss", turns: s.turn, reason: s.reason, first: s.first === V, at: Date.now(), log: s.log.slice(-14).map((l) => l.m) }).catch((e) => console.warn(e));
  }
  lsDel(SAVE); draw(); if (G.mode === "friend") ladderReset();
  if (G.rec && G.mode !== "friend") { const g = G; setTimeout(() => { if (G === g) openSummary(g); }, 2600); } // after the banner and the falling gold or ash
}

// an achievement earned this game: a gold notice with what it opened up
function celebrate(list) {
  for (const [k, a] of list.entries()) setTimeout(() => { const el = h("div", { class: "achpop glass", role: "status" }, h("span", { class: "eyebrow" }, "ปลดล็อคความสำเร็จ"), h("b", null, a.name), a.gives ? h("span", { class: "small" }, "ได้ " + rewardName(a.gives) + " · เลือกใช้ในหน้าตั้งค่า") : null);
    document.body.append(el); Sfx.play("win"); if (window.gsap) window.gsap.fromTo(el, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(2)" });
    setTimeout(() => (window.gsap ? window.gsap.to(el, { opacity: 0, duration: 0.5, onComplete: () => el.remove() }) : el.remove()), 4200); }, k * 4600);
}
// ---------- puzzles (see puzzles.js): win before the turn passes; take-backs and hints as often as wanted ----------
const PZ_DONE = "bot.pz";
let puzzleList = null;
const loadPuzzles = () => (puzzleList = puzzleList || import("../puzzles-data.js?v=20261111133209").then((m) => m.PUZZLES));
function startPuzzle(pz, k) {
  let s; try { s = puzzleState(pz); } catch (e) { return toast("เปิดโจทย์ไม่ได้: " + e.message, "bad"); }
  const V = pz.p; Object.assign(s.P[V], { uid: Me.uid, name: myName(), ava: myAvatar(), av3: myFigure(), sig: mySigil(), bot: false }); Object.assign(s.P[1 - V], { uid: null, name: "คู่แข่งในโจทย์", ava: "", av3: myFigure() ? "chang" : "", bot: true });
  G = { s, V, mode: "bot", brain: "basic", puzzle: { id: pz.id, k, len: pz.len }, id: s.id, saved: false, rec: { start: JSON.stringify(s), acts: [] } };
  persist(); go(); toast(`โจทย์ที่ ${k + 1}: ชนะให้ได้ก่อนจบเทิร์นนี้`);
}
function puzzleRestart() { const pz = G && G.puzzle; if (!pz) return; loadPuzzles().then((PZ) => { const z = PZ.find((x) => x.id === pz.id); if (!z) return; stopGame(true); startPuzzle(z, pz.k); }); }
function puzzleNext() { const pz = G && G.puzzle; loadPuzzles().then((PZ) => { const k = pz ? pz.k + 1 : 0; stopGame(true); if (PZ[k]) startPuzzle(PZ[k], k); else { toast("ครบทุกโจทย์แล้ว เก่งมาก!"); location.hash = "#play"; } }); }
// a hint: Ciel searches from the table as it is now, so it still helps after a different start
function puzzleHint() {
  const s = G.s, V = G.V, g = G; if (whoActs(s) !== V || s.phase === "over" || G.pzFail || G.thinking) return;
  G.thinking = "ชิเอลกำลังหาทางชนะ…"; draw();
  setTimeout(() => { // let the "thinking" line show before the search holds the page for a moment
    if (G !== g) return; G.thinking = null; let r = null;
    try { r = solveTurn(s, V, 7, 40000); } catch { draw(); return toast("ตำแหน่งนี้ซับซ้อนเกินกว่าจะคิดทัน ลองย้อนตาแล้วกดใหม่", "bad"); }
    if (!r.line || !r.line.length) { draw(); return toast("จากตรงนี้ชนะในเทิร์นนี้ไม่ได้แล้ว ลองย้อนตา (↶)", "bad"); }
    G.hints = (G.hints || 0) + 1; G.say = "คำใบ้: " + r.line[0].d; toast(G.say); draw();
  }, 60);
}
const recStart = (rec) => (rec.start ? JSON.parse(rec.start) : E.newGame(rec.init));
// ---------- replays: a local game keeps its set-up and every action, so the history page can play it back ----------
const RP = "bot.rp.", RPIDX = "bot.rp.idx", RP_KEEP = 30;
function keepReplay(mid) {
  if (!G.rec) return false; lsSet(RP + mid, { rec: G.rec, V: G.V, at: Date.now() }); if (!lsGet(RP + mid, null)) return false; // the browser may be out of room
  const idx = [mid, ...lsGet(RPIDX, []).filter((x) => x !== mid)]; for (const old of idx.slice(RP_KEEP)) lsDel(RP + old); lsSet(RPIDX, idx.slice(0, RP_KEEP)); return true;
}
export const hasReplay = (mid) => lsGet(RP + mid, null) != null;
export function openReplay(mid) {
  const r = lsGet(RP + mid, null); if (!r) return toast("รีเพลย์ของเกมนี้ไม่ได้เก็บไว้ในเครื่องนี้");
  if (G) stopGame(!!(G.s && G.s.phase === "over")); // a finished game leaves nothing to resume
  G = { s: recStart(r.rec), V: r.V, mode: "replay", replay: { rec: r.rec, k: 0, play: false }, saved: true }; G.id = G.s.id;
  go();
}
const replayApply = (s, [p, a]) => (a.type === "__lose" ? E.lose(s, p, a.reason) : E.apply(s, JSON.parse(JSON.stringify(a)), p));
function replayStep() {
  const R = G && G.replay; if (!R || R.k >= R.rec.acts.length) { if (R) { R.play = false; draw(); } return false; }
  try { replayApply(G.s, R.rec.acts[R.k]); } catch (e) { toast("รีเพลย์ไปต่อไม่ได้: " + e.message, "bad"); R.play = false; draw(); return false; }
  R.k++; Arena.update(G.s, view()); draw(); return true;
}
// jumping (back, to a turn, along the bar) rebuilds the game from its start; the table is laid out without animation
function replaySeek(k, toTurn) {
  const R = G.replay; R.play = false; const n = R.rec.acts.length; k = Math.max(0, Math.min(n, k));
  const s = recStart(R.rec); let j = 0;
  for (; j < (toTurn ? n : k); j++) { if (toTurn && s.turn >= toTurn) break; try { replayApply(s, R.rec.acts[j]); } catch { break; } }
  G.s = s; R.k = j; Arena.update(s, view(), { reset: true, flush: true }); draw();
}
async function replayRun() { const R = G.replay; while (G && G.replay === R && R.play) { await Arena.idle(); await sleep(450 / (R.speed || 1)); if (!G || G.replay !== R || !R.play || !replayStep()) break; } }
function replayBar() {
  const R = G.replay, n = R.rec.acts.length;
  const ib = (icon, label, disabled, fn) => h("button", { class: "btn sm", title: label, "aria-label": label, disabled, onclick: fn }, icon);
  return h("div", { class: "rpbar glass", role: "toolbar", "aria-label": "ควบคุมรีเพลย์" },
    ib("⏮\uFE0E", "กลับไปเริ่มเกม", R.k === 0, () => replaySeek(0)),
    ib("◀\uFE0E", "ย้อนหนึ่งจังหวะ", R.k === 0, () => replaySeek(R.k - 1)),
    h("button", { class: "btn sm gold", disabled: R.k >= n && !R.play, onclick: () => { R.play = !R.play; draw(); if (R.play) replayRun(); } }, R.play ? "หยุด" : "เล่น"),
    ib("▶\uFE0E", "ไปข้างหน้าหนึ่งจังหวะ", R.k >= n, () => { R.play = false; replayStep(); }),
    ib("⏭\uFE0E", "ไปเทิร์นถัดไป", R.k >= n, () => replaySeek(0, G.s.turn + 1)),
    h("button", { class: "btn sm", title: "ความเร็ว", "aria-label": `ความเร็ว ${R.speed || 1} เท่า`, onclick: () => { R.speed = { 1: 2, 2: 4, 4: 1 }[R.speed || 1]; Arena.setSpeed(R.speed); draw(); } }, `×${R.speed || 1}`),
    h("input", { type: "range", min: 0, max: n, value: R.k, "aria-label": "ตำแหน่งในรีเพลย์", onchange: (e) => replaySeek(+e.target.value) }),
    h("span", { class: "tiny muted num" }, `${R.k}/${n}`));
}
// ---------- the summary after a game: what each side did, worked out by replaying the record ----------
function gameStats(rec) {
  const s = recStart(rec); const st = [0, 1].map(() => ({ summon: 0, cast: 0, attack: 0, lifeHit: 0, broke: 0, played: {} })); let seen = s.evc || 0;
  for (const a of rec.acts) {
    try { replayApply(s, a); } catch { break; }
    for (const e of s.ev || []) if (e.id > seen) {
      seen = e.id; const L = e.i != null ? E.locate(s, e.i) : null; const nm = L ? E.name(s, L.x) : null;
      if (e.k === "summon" || e.k === "cast") { st[e.p][e.k]++; if (nm) st[e.p].played[nm] = (st[e.p].played[nm] || 0) + 1; }
      else if (e.k === "declare") st[e.by].attack++;
      else if (e.k === "life") st[1 - e.p].lifeHit++;
      else if (e.k === "destroy") st[1 - e.p].broke++;
    }
  }
  return st;
}
function openSummary(g) {
  if (!g || !g.rec) return; const s = g.s, V = g.V, st = gameStats(g.rec), me = st[V], op = st[1 - V];
  const res = s.winner === V ? "ชนะ" : s.winner == null ? "เสมอ" : "แพ้", top = (o) => Object.entries(o.played).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, k]) => `${n}${k > 1 ? " ×" + k : ""}`).join(", ") || "-";
  const row = (t, a, b) => h("div", { class: "sumrow" }, h("span", null, t), h("b", { class: "num" }, a), h("b", { class: "num" }, b));
  openSheet((api) => [h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ผล"), h("b", { style: `color:${res === "ชนะ" ? "#8ee3b2" : res === "แพ้" ? "#ffb0b2" : "inherit"}` }, res)),
      h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ยาว"), h("b", null, s.turn + " เทิร์น"))),
    h("div", { class: "small muted" }, s.reason || ""),
    g.fish && s.winner === V ? h("div", { class: "small" }, h("b", null, "ซ้อมมือเดียว: "), `ชนะในเทิร์นที่ ${s.turn} ของเกม คือตาที่ ${s.first === V ? Math.ceil(s.turn / 2) : Math.floor(s.turn / 2)} ของเรา`, g.undos ? ` · ย้อนตา ${g.undos} ครั้ง` : "") : null,
    h("div", { class: "sumtab" }, h("div", { class: "sumrow head tiny muted" }, h("span"), h("span", null, s.P[V].name), h("span", null, s.P[1 - V].name)),
      row("อัญเชิญ Avatar", me.summon, op.summon), row("ใช้ Magic", me.cast, op.cast), row("ประกาศโจมตี", me.attack, op.attack), row("ทำลายการ์ดคู่แข่ง", me.broke, op.broke), row("ทำ LIFE คู่แข่งหงาย", me.lifeHit, op.lifeHit)),
    h("div", { class: "small" }, h("b", null, "ลงบ่อยของเรา: "), top(me)), h("div", { class: "small muted" }, h("b", null, "ของคู่แข่ง: "), top(op)),
    h("div", { class: "row" }, g.mode !== "replay" ? h("button", { class: "btn gold", onclick: () => { api.close(); if (G === g) rematch(); } }, "ดวลอีกครั้ง") : null,
      hasReplay(s.id + "-" + V) ? h("button", { class: "btn", onclick: () => { api.close(); openReplay(s.id + "-" + V); } }, "ดูรีเพลย์") : null,
      h("button", { class: "btn", onclick: () => api.close() }, "ดูกระดาน"))], { title: "สรุปเกม", sub: g.fish ? `${s.P[V].deckName} · ซ้อมมือเดียว` : `${s.P[V].deckName} vs ${s.P[1 - V].deckName}` });
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
  const ax = P.av.find((y) => y.i === att); const helpers = ax ? P.av.filter((y) => E.helpOf(s, p, ax, y)) : [];
  if (!helpers.length) return doAct({ type: "attack", i: att, tk, ti }, p);
  G.helperPick = { att, tk, ti, sup: [] }; draw();
}

// ---------- HUD ----------
const ICON = { flip: "M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7", coach: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2z", tools: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4", hell: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4",
  ask: "M4 6h16v12H4zM4 7l8 6 8-6", emote: "M4 5h16v10H10l-4 4v-4H4zM9 10h.01M12 10h.01M15 10h.01", sound: "M5 10v4h3l4 3V7L8 10zM16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11", mute: "M5 10v4h3l4 3V7L8 10zM16 10l4 4M20 10l-4 4" };
const idleBar = () => (G && G.idleShown && oppIdle() > IDLE_MS ? h("div", { class: "idlebar glass", role: "status" }, h("span", null, `${G.s.P[1 - G.V].name} ไม่ได้เล่นมา ${Math.floor(oppIdle() / 60e3)} นาที`),
  h("button", { class: "btn sm gold", onclick: () => confirmBox("ขอชนะเกมนี้เพราะคู่แข่งไม่อยู่?", "ขอชนะ", claimIdle) }, "ขอชนะเกมนี้")) : null);
function tool(icon, label, short, fn, off) {
  const ic = h("span", { class: "ic" }); ic.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[icon]}"/></svg>`;
  return h("button", { class: "tool", type: "button", title: label, "aria-label": label, disabled: !!off, onclick: fn }, ic, h("span", null, short));
}
function crystals(P, opp, prevKey) {
  const prev = G[prevKey] ?? P.life.filter((x) => x.up).length; const now = P.life.filter((x) => x.up).length; G[prevKey] = now; const crit = E.critical(P);
  return h("div", { class: "crys", role: "img", "aria-label": `LIFE เหลือ ${5 - now} จาก 5` }, [0, 1, 2, 3, 4].map((k) => h("i", { class: "cry" + (opp ? " opp" : "") + (k < now ? " gone" : "") + (k < now && k >= prev ? " now" : "") + (crit ? " crit" : "") })));
}
function draw() {
  if (!G || !G.hud || !G.s) return; if (G.hoverHand != null && !G.s.P[view()].hand.some((x) => x.i === G.hoverHand)) G.hoverHand = null; const s = G.s; const V = view(); const me = s.P[V], op = s.P[1 - V]; const p = whoActs(s);
  const myTurn = p != null && mine(p);
  const hint0 = G.replay ? `รีเพลย์ · เทิร์น ${s.turn} · ${s.phase === "over" ? "จบเกม" : "ตาของ " + s.P[s.active].name}`
    : G.puzzle && (G.pzFail || s.phase === "over") ? (s.phase === "over" && s.winner === V ? `ไขโจทย์ที่ ${G.puzzle.k + 1} สำเร็จ!` : "หมดเทิร์นแล้วยังไม่ชนะ · ย้อนตาหรือเริ่มโจทย์ใหม่")
    : G.watch ? (s.phase === "over" ? (s.winner == null ? "เสมอ · " : s.P[s.winner].name + " ชนะ · ") + s.reason : "กำลังชม" + (p == null ? "" : ` · รอ ${s.P[p].name}…`)) : s.phase === "over" ? (s.winner === V ? "ชนะ! " : s.winner == null ? "เสมอ · " : "แพ้ · ") + s.reason
    : G.thinking || (p == null ? "" : !mine(p) ? `รอ ${s.P[p].name}…` : s.phase === "mull" ? "เลือกการ์ดที่จะเปลี่ยน หรือเก็บมือเดิม" : s.trig.length ? "มีเอฟเฟกต์ต้องจัดการ" : s.pend ? "ถูกโจมตี เลือกการตอบโต้" : s.phase === "main" ? "Main Phase · แตะการ์ดบนมือเพื่อเล่น" : s.phase === "battle" ? (G.att ? "เลือกเป้าหมายบนสนาม" : "Battle · เลือก Avatar ที่ตื่นเพื่อโจมตี") : s.phase === "end" && s.need ? `ทิ้งการ์ด ${s.need} ใบ` : "");
  const hint = G.puzzle && !G.pzFail && s.phase !== "over" && hint0 ? `โจทย์ที่ ${G.puzzle.k + 1} · ` + hint0 : hint0;
  const pile = (P, z, t) => h("button", { onclick: () => openPile(P, z) }, h("b", null, P[z].length), h("span", null, t));
  const ph = ["draw", "main", "battle", "end"];
  if (compact()) {
    G.hud.replaceChildren(
      h("div", { class: "oppbar glass" }, op.bot && !op.ava ? h("span", { class: "ava sm" }, "✦") : avatarEl(op.ava, op.name, "sm"), h("div", { class: "pname" }, h("b", null, op.name), h("span", null, `มือ ${op.hand.length} · Deck ${op.deck.length}`)), crystals(op, true, "pcOp")),
      hint ? h("div", { class: "hint" }, G.say && !mine(p ?? -1) ? "✦ " + G.say : hint) : null,
      G.watch ? watchHand(me) : handZone(s, V, p), promptBox(s, p), tutorBox(s, V, p), idleBar(),
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
    h("aside", { class: "matchp" },
      // turn hub: whose turn it is (gold = ours, crimson = theirs), the phase track, and the one button that moves the turn on
      h("section", { class: "hub " + (s.phase === "over" ? "done" : s.active === V ? "mine" : "theirs"), "aria-label": "สถานะเทิร์น" },
        h("div", { class: "hubtop" }, h("div", { class: "tn" }, h("span", null, "เทิร์น"), h("b", null, s.turn)),
          h("div", { class: "who" }, s.phase === "over" ? "จบเกม" : s.phase === "mull" ? "เปลี่ยนมือ" : s.active === V && !G.watch ? "ตาของคุณ" : "ตาของ " + s.P[s.active].name)),
        h("ol", { class: "ptrack", "aria-label": "เฟสของเทิร์น" }, ph.map((k, i) => h("li", { class: s.phase === k ? "on" : ph.indexOf(s.phase) > i ? "past" : "", "aria-current": s.phase === k ? "step" : null }, PHASE_TH[k]))),
        (() => { const acts = turnButtons(s, p).filter(Boolean); if (acts.length) return h("div", { class: "hubacts" }, acts);
          const wait = p == null ? "" : !mine(p) ? `รอ ${s.P[p].name}` : s.phase === "mull" ? "เลือกการ์ดที่จะเปลี่ยน" : s.trig.length ? "จัดการเอฟเฟกต์ในกล่องกลางจอ" : s.pend ? "เลือกการตอบโต้ในกล่องกลางจอ" : "";
          return wait ? h("div", { class: "hubwait" }, !mine(p) ? h("span", { class: "dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")) : null, wait) : null; })(),
        G.puzzle && !G.pzFail && s.phase !== "over" ? h("span", { class: "chip gold" }, "เป้าหมาย: ชนะก่อนจบเทิร์นนี้ · คู่แข่งไม่มีการ์ดบนมือ") : null,
        E.critical(me) ? h("span", { class: "chip bad" }, "สาหัส! ถูกตี LIFE อีกครั้งจะแพ้") : null,
        E.deckOpen(s) ? h("span", { class: "chip", title: "การ์ดบนสุดของ Deck ถูกหงายหน้าอยู่ (ความสามารถต่อเนื่อง)" }, `บนสุดของ Deck · ${[E.deckOpen(s, V) ? `${G.watch ? me.name : "เรา"}: ${me.deck[0] ? E.name(s, me.deck[0]) : "-"}` : null, E.deckOpen(s, 1 - V) ? `${op.name}: ${op.deck[0] ? E.name(s, op.deck[0]) : "-"}` : null].filter(Boolean).join(" · ")}`) : null,
        h("div", { class: "meplate" }, avatarEl(me.ava, me.name, "me sm"), h("b", null, me.name), crystals(me, false, "pcMe"), G.replay || G.watch ? null : h("button", { class: "btn sm emobtn", title: "ส่งอีโมต", "aria-label": "ส่งอีโมต", onclick: emotePicker }, "💬")),
        h("div", { class: "pilebar" }, pile(me, "deck", "Deck"), pile(me, "hell", "นรก"), pile(me, "dark", "มิติมืด"))),
      h("div", { class: "rail hidem" }, G.watch ? tool("flip", "สลับไปดูจากอีกฝั่ง", "สลับฝั่ง", flipWatch) : tool("coach", "ชิเอลแนะนำ", "แนะนำ", coach, s.phase === "over"), G.watch ? null : tool("tools", "เครื่องมือจัดการสนามเอง", "เครื่องมือ", tools, s.phase === "over"), tool("hell", G.watch ? "ดูนรกของ " + op.name : "ดูนรกของคู่แข่ง", G.watch ? "นรกอีกฝั่ง" : "นรกคู่แข่ง", () => openPile(op, "hell")),
        isOwner() && !G.watch ? tool("ask", "ถามชิเอลเกี่ยวกับตานี้", "ถามชิเอล", () => openAsk()) : null, tool(Sfx.on || Music.on ? "sound" : "mute", "เสียงเอฟเฟกต์และเพลง", "เสียง", soundSheet)),
      G.coach ? h("div", { class: "coachbox" }, G.coach) : null,
      h("div", { class: "feed", "aria-live": "polite", tabindex: "0", "aria-label": "บันทึกเกม" }, s.log.slice(-30).reverse().map((l) => h("div", { class: l.s === V ? "mine" : l.s === 1 - V ? "opp" : "" }, l.m)))),
    G.watch ? watchHand(me) : handZone(s, V, p), promptBox(s, p), tutorBox(s, V, p), idleBar(),
    h("button", { class: "btn sm arena-exit", onclick: () => (s.phase === "over" || G.watch ? exitGame() : confirmBox("ออกจากสนาม? เกมที่ค้างจะเก็บไว้ให้เล่นต่อ", "ออก", exitGame)) }, "← ออก"));
  afterDraw(s, V, op, myTurn);
}
// ---------- learn mode: each part of the game explained the first time it comes up ----------
const mainMine = (s, V, p) => s.phase === "main" && s.active === V && p === V && !s.trig.length && !s.rw && !s.pend;
const canDo = (s, V, type) => legalMoves(s, V).some((m) => m.a.type === type);
const recentFight = (s) => s.log.slice(-12).some((l) => /แพ้การต่อสู้|พลังเท่ากัน/.test(l.m));
const LESSONS = [
  { k: "start", when: (s) => s.phase === "mull", t: "ยินดีต้อนรับสู่สนามดวล",
    b: () => ["ฝั่งล่างเป็นของคุณ ฝั่งบนเป็นของบอท ทุกคนเริ่มด้วยการ์ดบนมือ 5 ใบ และ LIFE 5 ใบที่คว่ำไว้", "ตอนนี้เปลี่ยนมือได้ครั้งเดียว แตะการ์ดที่ไม่อยากเก็บแล้วกดเปลี่ยน หรือกด เก็บมือเดิม"] },
  { k: "turn", when: mainMine, t: "ลำดับในหนึ่งเทิร์น",
    b: () => ["Draw → Main → Battle → End ดูเฟสปัจจุบันได้ที่แถบด้านขวา", "ต้นเทิร์นจั่ว 1 ใบ ถ้ามือเหลือไม่ถึง 3 ใบจะจั่วจนครบ 3", "ผู้ที่เริ่มก่อนไม่มี Battle Phase ในเทิร์นแรก"] },
  { k: "zones", when: mainMine, t: "โซนบนสนาม",
    b: () => ["Avatar Zone คือกรอบใหญ่ตรงกลาง ลง Avatar ได้ 4 ใบ", "Magic Zone เก็บการ์ดที่สวมใส่อยู่ ส่วน Construct Zone เก็บสิ่งก่อสร้างได้ 3 ใบ", "Land Magic Zone ด้านซ้ายใช้ร่วมกันทั้งสองฝ่าย ลงใบใหม่จะแทนที่ใบเดิม"] },
  { k: "summon", when: (s, V, p) => mainMine(s, V, p) && canDo(s, V, "summon"), t: "อัญเชิญ Avatar",
    b: () => ["แตะการ์ด Avatar บนมือ แล้วเลือกการ์ดใบอื่นบนมือมาจ่าย Cost", "Cost คือเลขมุมซ้ายบนของการ์ด จ่ายด้วย GEM คือรูปเพชรที่ขอบบนของการ์ด", "การ์ดที่ใช้จ่ายจะลงนรก"] },
  { k: "pay", when: () => G.payFor != null, t: "จ่าย GEM",
    b: () => ["เลือกการ์ดบนมือให้ GEM รวมถึง Cost แล้วกดยืนยัน จ่ายเกินจำเป็นไม่ได้", "GEM ที่มีสีใช้จ่ายได้เฉพาะการ์ดสีเดียวกัน", "ถ้าจ่ายพอดีกับ Cost การ์ดที่มีคำว่า พอดี จะได้ความสามารถเพิ่ม"] },
  { k: "effect", when: (s, V) => s.trig.length > 0 && s.trig[0].seat === V, t: "ความสามารถของการ์ด",
    b: () => ["ความสามารถทำงานเองตามจังหวะที่เขียนไว้ เช่น จุติ ทำงานตอนอัญเชิญแบบจ่าย Cost", "ถ้าต้องเลือกเป้าหมายหรือเลือกปฏิบัติ เกมจะถามคุณ"] },
  { k: "magic", when: (s, V, p) => mainMine(s, V, p) && canDo(s, V, "cast"), t: "Magic มี 4 แบบ",
    b: () => ["Normal ใช้ใน Main Phase ของเรา · Modification สวมใส่ให้ Avatar · Land วางบน Land Magic Zone", "React ใช้ตอบโต้ตอนอีกฝ่ายทำบางอย่าง", "Magic แต่ละแบบใช้ได้เทิร์นละ 1 ใบ"] },
  { k: "battle", when: (s, V, p) => mainMine(s, V, p) && s.turn > 1 && s.P[V].av.some((x) => x.a), t: "เข้าสู่ Battle Phase",
    b: () => ["ลงการ์ดใน Main Phase เสร็จแล้ว กด ไป Battle Phase", "Avatar ที่ตื่นอยู่สั่งโจมตีได้ตัวละครั้ง โจมตีแล้วจะนอน"] },
  { k: "attack", when: (s, V, p) => s.phase === "battle" && s.active === V && p === V && canDo(s, V, "attack"), t: "สั่งโจมตี",
    b: () => ["แตะ Avatar ของเราที่ตื่นอยู่ แล้วเลือกเป้าหมาย", "โจมตี LIFE ได้เมื่ออีกฝ่ายไม่มี Avatar หรือการ์ดของเรามีความสามารถ เตะไข่", "ไม่มีอะไรจะทำแล้วกด จบเทิร์น"] },
  { k: "fight", when: (s) => recentFight(s), t: "ผลการต่อสู้",
    b: () => ["เทียบ POWER ฝ่ายที่น้อยกว่าถูกทำลายลงนรก", "POWER เท่ากันถูกทำลายทั้งคู่ ยกเว้นฝ่ายที่มีความสามารถ ลูกฮึด"] },
  { k: "defend", when: (s, V) => !!s.pend && s.pend.by !== V, t: "ถูกโจมตี",
    b: () => ["เลือกได้ว่าจะปล่อยให้โจมตี ให้ Avatar ที่มี โล่มนุษย์ รับแทน หรือใช้ React", "ถ้าไม่มีอะไรตอบโต้ได้ เกมจะไปต่อเอง"] },
  { k: "react", when: (s, V) => !!s.rw && s.rw.by !== V && E.reactsFor(s, V, s.rw).length > 0, t: "จังหวะตอบโต้",
    b: () => ["อีกฝ่ายเพิ่งทำบางอย่าง และคุณมี React ที่ใช้ตอบได้", "กดใช้การ์ด หรือ ไม่ตอบโต้ เพื่อปล่อยผ่าน"] },
  { k: "life", when: (s) => s.P.some((P) => P.life.some((y) => y.up)), t: "LIFE Card",
    b: () => ["ถูกโจมตีเข้า LIFE จะหงาย LIFE 1 ใบ บางใบมีความสามารถทำงานตอนถูกหงาย", "LIFE หงายครบ 5 ใบเรียกว่าสถานะสาหัส ถูกโจมตีเข้า LIFE อีกครั้งจะแพ้"] },
  { k: "discard", when: (s, V) => s.phase === "end" && s.active === V && s.need > 0, t: "มือเกิน 7 ใบ",
    b: () => ["ตอนจบเทิร์นถ้ามีการ์ดบนมือเกิน 7 ใบ ต้องทิ้งจนเหลือ 7", "แตะการ์ดบนมือที่จะทิ้ง"] },
  { k: "critical", when: (s) => s.phase !== "over" && s.P.some((P) => E.critical(P)), t: "สถานะสาหัส",
    b: (s) => [`LIFE ของ${s.P.filter((P) => E.critical(P)).map((P) => P.name).join(" และ ")}หงายครบ 5 ใบแล้ว`, "ถูกโจมตีเข้า LIFE อีกครั้งจะแพ้ทันที"] },
  { k: "tools", when: (s, V, p) => mainMine(s, V, p) && s.turn >= 3, t: "ตัวช่วยระหว่างเล่น",
    b: () => ["ปุ่ม แนะนำ ให้ชิเอลบอกท่าที่น่าเล่นในตานี้", "ชี้หรือแตะการ์ดเพื่อดูรายละเอียดเต็ม", "ปุ่ม นรกคู่แข่ง เปิดดูการ์ดที่ลงนรกของบอท"] },
  { k: "over", when: (s) => s.phase === "over", t: "จบเกม",
    b: (s, V) => [s.winner === V ? "ชนะแล้ว! ต่อไปลองดวลกับบอทด้วยเด็คของคุณเองได้เลย" : "ไม่เป็นไร เริ่มสอนเล่นใหม่ได้ หรือไปจัดเด็คของคุณที่หน้า เด็ค", "ประวัติเกมนี้ดูย้อนหลังได้ที่หน้า ประวัติ"] },
];
function tutorBox(s, V, p) {
  if (!G.learn) return null; const seen = G.learn.seen || (G.learn.seen = {});
  const k = LESSONS.find((l) => !seen[l.k] && l.when(s, V, p)); if (!k) return null;
  const fresh = G.learn.last !== k.k; G.learn.last = k.k;
  return h("aside", { class: "tutor" + (fresh ? " fresh" : ""), "aria-live": "polite" }, h("div", { class: "in" }, h("b", null, k.t), h("ul", null, k.b(s, V).map((t) => h("li", null, t))),
    h("div", { class: "row" }, h("button", { class: "btn gold sm", onclick: () => { seen[k.k] = 1; persist(); draw(); } }, "เข้าใจแล้ว"), h("button", { class: "btn sm", onclick: () => { G.learn = null; persist(); draw(); } }, "ปิดคำอธิบาย"))));
}
// sound settings: effects and music each switch on and off and have their own volume
function soundSheet() {
  const row = (label, sub, on, set, vol, setVol) => h("div", { class: "sndrow" },
    h("label", { class: "chk" }, h("input", { type: "checkbox", checked: on, onchange: (e) => { set(e.target.checked); Sfx.play("click"); } }), h("b", null, label)),
    h("span", { class: "tiny muted" }, sub),
    h("input", { type: "range", min: 0, max: 1, step: 0.05, value: vol, "aria-label": "ความดัง" + label, oninput: (e) => setVol(+e.target.value), onchange: () => Sfx.play("click") }));
  openSheet([row("เสียงเอฟเฟกต์", "อัญเชิญ โจมตี ทำลาย เปลี่ยนเทิร์น", Sfx.on, (v) => { if (v !== Sfx.on) Sfx.toggle(); }, Sfx.vol, (v) => Sfx.setVolume(v)),
    row("เพลงประกอบ", "วงปี่พาทย์ที่แต่งสดตามจังหวะเกม", Music.on, (v) => { if (v !== Music.on) Music.toggle(); }, Music.vol, (v) => Music.setVolume(v))], { title: "เสียง", onClose: () => draw() });
}
// the music follows the game: our turn or theirs, a fight, someone one LIFE from losing, the end
function musicMood(s, V) {
  if (s.phase === "over") return s.winner === V ? "win" : "lose";
  const crit = E.critical(s.P[V]) || E.critical(s.P[1 - V]), fight = s.phase === "battle" || !!s.pend;
  return crit ? (fight ? "climax" : "tense") : fight ? "battle" : s.phase === "mull" || s.active === V ? "mine" : "foe";
}
function afterDraw(s, V, op, myTurn) {
  const me = s.P[V]; Music.mood(musicMood(s, V)); if (G.replay) G.hud.append(replayBar());
  drawInspector();
  const targets = [];
  if (G.att) { targets.push(...op.av.map((x) => x.i), ...op.cs.map((x) => x.i)); }
  else if (myTurn && s.phase === "battle" && !s.pend && !s.trig.length) targets.push(...me.av.filter((x) => x.a).map((x) => x.i));
  if (G.host) targets.push(...s.P[0].av.map((x) => x.i), ...s.P[1].av.map((x) => x.i));
  Arena.highlight(targets); const AL = G.att && E.locate(s, G.att); Arena.setLifeTarget(!!AL && (!op.av.length || E.kw(s, AL.x, "เตะไข่")));
}
function gameMenu(s, V) {
  const me = s.P[V], op = s.P[1 - V];
  if (G.watch) return openSheet((api) => [
    h("div", { class: "row" }, ...[[me, "hell"], [me, "dark"], [op, "hell"], [op, "dark"]].map(([P, z]) => h("button", { class: "btn sm", onclick: () => { api.close(); openPile(P, z); } }, `${ZONE_TH[z]} ${P.name} ${P[z].length}`))),
    h("div", { class: "row" }, s.phase === "over" ? null : h("button", { class: "btn sm", onclick: () => { api.close(); flipWatch(); } }, "สลับฝั่ง"), h("button", { class: "btn sm", onclick: () => { api.close(); soundSheet(); } }, Sfx.on || Music.on ? "🔊 เสียงและเพลง" : "🔇 เสียงและเพลง"),
      h("button", { class: "btn sm danger", onclick: () => { api.close(); exitGame(); } }, "เลิกดู")),
    h("div", { class: "eyebrow" }, "บันทึกเกม"), h("div", { class: "glog", style: "max-height:44vh" }, s.log.slice(-40).reverse().map((l) => h("div", { class: l.s === V ? "mine" : "" }, l.m)))], { title: `ชมเกม · เทิร์น ${s.turn} · ${s.P[s.active].name}` });
  openSheet((api) => [
    h("div", { class: "row" }, ...[[me, "deck", "Deck"], [me, "hell", "นรกเรา"], [me, "dark", "มิติมืดเรา"], [op, "hell", "นรกคู่แข่ง"]].map(([P, z, t]) => h("button", { class: "btn sm", onclick: () => { api.close(); openPile(P, z); } }, `${t} ${P[z].length}`))),
    isOwner() ? h("div", { class: "row" }, h("button", { class: "btn sm ciel", onclick: () => { api.close(); openAsk(); } }, "✉ ถามชิเอล (แนบสถานะเกม)")) : null,
    h("div", { class: "row" }, h("button", { class: "btn sm ciel", disabled: s.phase === "over", onclick: () => { api.close(); coach().then(() => G && G.coach && openSheet(h("div", { class: "coachbox" }, G.coach), { title: "ชิเอลแนะนำ" })); } }, "ชิเอลแนะนำ"), h("button", { class: "btn sm", disabled: s.phase === "over", onclick: () => { api.close(); tools(); } }, "เครื่องมือ"),
      h("button", { class: "btn sm", onclick: () => { api.close(); soundSheet(); } }, Sfx.on || Music.on ? "🔊 เสียงและเพลง" : "🔇 เสียงและเพลง"),
      h("button", { class: "btn sm", onclick: () => { api.close(); openReport(); } }, "แจ้งปัญหา"),
      undoPoint() >= 0 ? h("button", { class: "btn sm", onclick: () => { api.close(); undoLast(); } }, "↶ ย้อนตา") : null,
      G.puzzle && !G.pzFail && s.phase !== "over" ? h("button", { class: "btn sm ciel", onclick: () => { api.close(); puzzleHint(); } }, "คำใบ้") : null,
      G.replay ? null : h("button", { class: "btn sm", onclick: () => { api.close(); emotePicker(); } }, "💬 อีโมต"),
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
  const myBattle = myMove && s.active === p && s.phase === "battle" && !s.trig.length && !s.pend && !s.rw;
  if (sc && sc.activate && L.p === p && (myMain || (myBattle && sc.activate.battle)) && x.used !== s.turn && sc.activate.can(E, s, x, L)) acts.push([sc.activate.label, () => doAct({ type: "activate", i: x.i }, p), "ciel"]);
  if (!sc && L.p === p && myMain && E.ext.acts) for (const a of E.ext.acts(s, x, L)) acts.push(["สั่งใช้: " + a.label, () => doAct({ type: "activate", i: x.i, k: a.k }, p), "ciel"]);
  if (E.untargetable(s, x)) acts.push(["ถูกโจมตีไม่ได้ตอนนี้", null, "note"]);
  if (mine(L.p) && d.x && L.z !== "hand" && L.z !== "deck" && !sc) acts.push(["สั่งใช้ความสามารถ", () => doAct({ type: "useAbility", i: x.i }, L.p), ""]);
  const stat = [ZONE_TH[L.z], d.t === "M" ? "Magic " + SUB_TH[d.st] : d.t === "T" ? "Token" : "Cost " + (d.c ?? 0), "GEM " + (d.g || 0) + (d.gc ? " (" + d.gc + ")" : ""), d.pw != null || L.z === "av" ? "POWER " + (L.z === "av" || L.z === "cs" ? E.power(s, x) : d.pw || 0) : null, L.z === "av" ? (x.a ? "ตื่น" : "นอน") : null, d.sy ? "Symbol " + d.sy : null].filter(Boolean);
  { const tr = !sc && traits(d); const rules = tr ? [tr.taunt && "ฝ่ายตรงข้ามต้องโจมตีใบนี้เท่านั้น", tr.noControl && "ถูกเปลี่ยนการควบคุมไม่ได้", tr.noAttack && (tr.noAttack(E, s, x) ? "ตอนนี้โจมตีไม่ได้ตามเงื่อนไขบนการ์ด" : "โจมตีได้ (ครบเงื่อนไขบนการ์ด)")].filter(Boolean) : [];
    if (rules.length && (L.z === "av" || L.z === "cs")) acts.push(["กติกาบนการ์ด (คิดให้อัตโนมัติ): " + rules.join(" · "), null, "note"]); }
  { const ra = !(sc && sc.aura) && readAura(d); if ((sc && sc.aura) || ra) acts.push([ra ? "ต่อเนื่อง (คิดให้อัตโนมัติ): " + ra.desc : "ความสามารถต่อเนื่อง คิดให้อัตโนมัติ", null, "note"]); }
  const api = openSheet(() => h("div", { class: "cview" }, c ? holo(h("div", { class: "ccard big", style: "cursor:default" }, artImg(c))) : h("div", { class: "fx" }, "Token " + d.n),
    h("div", { class: "stack", style: "gap:8px;min-width:0" }, h("div", { class: "row", style: "gap:6px" }, stat.map((t) => h("span", { class: "chip" + (/^POWER/.test(t) ? " gold" : "") }, t)), (x.kw || []).map((k) => h("span", { class: "chip good" }, k))),
      acts.some((a) => a[1]) ? h("div", { class: "row acts" }, acts.filter((a) => a[1]).map(([t, fn, cls]) => h("button", { class: "btn " + (cls || ""), onclick: go(fn) }, t))) : null,
      ...acts.filter((a) => !a[1]).map(([t]) => h("div", { class: "cvnote" }, t)), // what the game already applies by itself
      d.x ? fxText(d.x) : h("div", { class: "muted small" }, "ไม่มีข้อความความสามารถ"))), { title: d.n, sub: s.P[L.p].name });
}
// the same decks again straight away (a random opponent is drawn again); learn mode replays its lesson game
// take-back (local games): rebuild the game from its start without my last deliberate move and everything after it;
// effects resolving on their own, answers and passes are stepped over, so the move undone is the one I actually chose
const UNDO_SKIP = new Set(["trig", "respond", "pass", "answer"]);
function undoPoint() {
  if (!G || !G.rec || G.replay || G.mode === "friend" || !G.s || G.s.phase === "over") return -1;
  const acts = G.rec.acts, human = (p) => G.mode === "solo" || p === G.V;
  for (let k = acts.length - 1; k >= 0; k--) if (human(acts[k][0]) && !UNDO_SKIP.has(acts[k][1].type) && acts[k][1].type !== "mull") return k;
  return -1;
}
function undoLast() {
  const k = undoPoint(); if (k < 0 || G.driving) return toast(G && G.driving ? "รอฝั่งตรงข้ามเล่นจบก่อนนะ" : "ยังไม่มีตาที่ย้อนได้");
  const s = recStart(G.rec); for (let j = 0; j < k; j++) { try { replayApply(s, G.rec.acts[j]); } catch (e) { return toast("ย้อนไม่ได้: " + e.message, "bad"); } }
  G.rec.acts.length = k; G.s = s; G.undos = (G.undos || 0) + 1; G.say = null; G.pzFail = false;
  G.pick = null; G.att = null; G.host = null; G.payFor = null; G.payVia = null; G.callVia = null; G.helperPick = null; G.castFor = null; G.tk = null; G.ask = null;
  persist(); Arena.update(s, view(), { reset: true, flush: true }); draw(); drive(); toast("ย้อนตาแล้ว");
}
const undoBtn = () => (undoPoint() >= 0 ? h("button", { class: "btn sm", title: "ย้อนตาล่าสุด (Ctrl+Z)", onclick: undoLast }, "↶ ย้อนตา") : null);
// turning a phone or resizing the window lays the HUD out again (the phone and desktop layouts differ)
let resizeT = 0; addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (G && G.hud && G.s) draw(); }, 200); });
addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && G && !G.replay && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "")) { e.preventDefault(); undoLast(); } });
function rematch() { const learn = G && G.learn, mode = G && G.mode, fish = G && G.fish; stopGame(true); if (learn) startLearn(); else startLocal(fish ? "goldfish" : mode === "solo" ? "solo" : "bot"); }
function exitGame() { if (G && G.replay) { stopGame(false); location.hash = "#history"; return; } const over = G && G.s && G.s.phase === "over"; stopGame(over); location.hash = "#play"; }
function turnButtons(s, p) {
  if (G.puzzle && !G.replay) { // puzzles: what to do after winning or running out of turn, and a hint while playing
    const choose = h("button", { class: "btn sm", onclick: () => { stopGame(true); location.hash = "#play"; } }, "เลือกโจทย์อื่น");
    if (s.phase === "over" && s.winner === G.V) return [h("button", { class: "btn gold sm", onclick: puzzleNext }, "โจทย์ถัดไป"), choose];
    if (s.phase === "over" || G.pzFail) return [undoBtn(), h("button", { class: "btn gold sm", onclick: puzzleRestart }, "เริ่มโจทย์ใหม่"), choose];
    const b = turnButtons0(s, p); return p === G.V && mine(p) && !s.trig.length && !s.pend && s.phase !== "mull" ? [...b, h("button", { class: "btn ciel sm", onclick: puzzleHint }, "คำใบ้")] : b;
  }
  return turnButtons0(s, p);
}
function turnButtons0(s, p) {
  if (G.replay) return [h("button", { class: "btn sm", onclick: exitGame }, "กลับหน้าประวัติ")];
  if (G.watch) return [s.phase === "over" ? null : h("button", { class: "btn sm", onclick: flipWatch }, "สลับฝั่ง"), h("button", { class: s.phase === "over" ? "btn gold sm" : "btn sm", onclick: exitGame }, s.phase === "over" ? "กลับหน้าเตรียมเกม" : "เลิกดู")];
  if (s.phase === "over") return [G.mode !== "friend" ? h("button", { class: "btn gold sm", onclick: rematch }, G.fish ? "ซ้อมอีกรอบ" : "ดวลอีกครั้ง")
      : G.offer ? h("button", { class: "btn gold sm", onclick: acceptRematch }, "รับคำท้า ดวลอีกครั้ง") : h("button", { class: "btn gold sm", onclick: friendRematch }, "ขอดวลอีกครั้ง"),
    G.rec && G.mode !== "friend" ? h("button", { class: "btn sm", onclick: () => openSummary(G) }, "สรุปเกม") : null,
    h("button", { class: "btn sm", onclick: () => { stopGame(true); location.hash = "#play"; } }, "กลับหน้าเตรียมเกม"), h("a", { class: "btn sm", href: "#history", onclick: () => stopGame(true) }, "ดูประวัติ")];
  if (p == null || !mine(p) || s.trig.length || s.pend || s.phase === "mull") return [];
  if (s.phase === "main") { // abilities used from hell / the dark zone have no card on the table to tap, so offer them here
    const far = [...s.P[p].hand, ...s.P[p].hell, ...s.P[p].dark, ...uniqDeckActs(s, s.P[p])].filter((x) => { const sc = scriptOf(s, x); return sc && sc.activate && x.used !== s.turn && sc.activate.can(E, s, x, E.locate(s, x.i)); }).slice(0, 4);
    return [h("button", { class: "btn gold sm", onclick: () => doAct({ type: "battle" }, p) }, s.turn === 1 ? "จบเทิร์น" : "ไป Battle Phase"), s.turn === 1 ? null : h("button", { class: "btn sm", onclick: () => doAct({ type: "end" }, p) }, "จบเทิร์นเลย"), compact() ? null : undoBtn(),
      ...far.map((x) => h("button", { class: "btn ciel sm", title: scriptOf(s, x).activate.label, onclick: () => doAct({ type: "activate", i: x.i }, p) }, `สั่งใช้ ${E.name(s, x)} (${ZONE_TH[E.locate(s, x.i).z]})`)),
      ...legalMoves(s, p).filter((m) => m.a.type === "cast" && m.a.from === "hell").slice(0, 4).map((m) => h("button", { class: "btn ciel sm", onclick: () => doAct(m.a, p) }, m.d))]; }
  if (s.phase === "battle") { const far = [...s.P[p].hand, ...s.P[p].hell, ...s.P[p].dark, ...s.P[p].mg].filter((x) => { const sc = scriptOf(s, x); return sc && sc.activate && sc.activate.battle && x.used !== s.turn && sc.activate.can(E, s, x, E.locate(s, x.i)); }).slice(0, 3);
    return [h("button", { class: "btn gold sm", onclick: () => doAct({ type: "end" }, p) }, "จบเทิร์น"), G.att ? h("button", { class: "btn sm", onclick: () => { G.att = null; draw(); } }, "ยกเลิกการเลือก") : compact() ? null : undoBtn(),
      ...far.map((x) => h("button", { class: "btn ciel sm", title: scriptOf(s, x).activate.label, onclick: () => doAct({ type: "activate", i: x.i }, p) }, `สั่งใช้ ${E.name(s, x)} (${ZONE_TH[E.locate(s, x.i).z]})`))]; }
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
      d.x ? fxText(d.x) : h("div", { class: "muted small" }, "ไม่มีข้อความความสามารถ"),
      pinned && mine(L.p) && d.x && L.z !== "hand" ? h("button", { class: "btn sm", onclick: () => doAct({ type: "useAbility", i: x.i }, L.p) }, "สั่งใช้ความสามารถ") : null,
      pinned ? h("button", { class: "btn sm", onclick: () => { G.sel = null; Arena.select(null); drawInspector(); } }, "ปิด") : null));
}
function handZone(s, V, p) {
  const P = s.P[V]; const n = P.hand.length; const row = compact(); const zone = h("div", { class: row ? "handzone handrow" : "handzone", "aria-label": "การ์ดบนมือ" });
  const w = Math.min(760, innerWidth * 0.92); const cw = Math.round(Math.max(86, Math.min(128, innerHeight * 0.19))); const gap = Math.min(cw * 0.78, (w - cw) / Math.max(1, n - 1));
  const sel = G.pick || []; const canPlay = p != null && mine(p) && p === V;
  P.hand.forEach((x, k) => {
    const d = E.def(s, x); const off = k - (n - 1) / 2; const c = d.im != null ? card(d.im) : null;
    const b = h("button", { class: "hcard" + (sel.includes(x.i) ? " sel" : ""), "data-i": x.i, "aria-label": `${d.n} ${TYPE_TH[d.t]} GEM ${d.g || 0}`, style: row ? "" : `width:${cw}px;left:${w / 2 - cw / 2 + off * gap}px;transform:translateY(${Math.abs(off) * Math.abs(off) * 2.2 + (sel.includes(x.i) ? -26 : 0)}px) rotate(${off * 3.2}deg);z-index:${k}` },
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
  if (x.borrow) { toast("การ์ดใบนี้ใช้ได้แค่เป็นค่า Cost ในการอัญเชิญ", "bad"); return showHandInspect(x); }
  if (d.t === "A" && E.locked(s, p, x)) return toast("อัญเชิญการ์ดใบนี้ไม่ได้ในเทิร์นนี้ (ผลของการ์ดที่ใช้ไปแล้ว)", "bad");
  if (d.t === "A" && (E.avatars(s.P[p]) >= 4 || s.P[p].av.length >= 6)) { toast("Avatar Zone เต็มแล้ว (Avatar ได้ 4 ใบ)", "bad"); return showHandInspect(x); }
  if (d.t === "A" && (E.hooks(s, x) || {}).noHand) { toast("การ์ดใบนี้ลงสนามจากบนมือไม่ได้", "bad"); return showHandInspect(x); }
  if (d.t === "C" && s.P[p].cs.length >= 3) { toast("Construct Zone เต็มแล้ว (3 ใบ)", "bad"); return showHandInspect(x); }
  if (d.t === "A" || d.t === "C") { const auto = E.autoPay(s, p, x.i); if (!auto) { toast(`GEM บนมือไม่พอจ่าย ${d.n} (Cost ${d.c || 0})`); return showHandInspect(x); } G.payFor = x.i; G.pick = auto; return draw(); }
  if (d.t === "M" && d.st === "D" && (scriptOf(s, x) || {}).castFree) return doAct({ type: "cast", i: x.i }, p);
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
      const on = s.rw && s.rw.by !== p ? s.rw : s.pend && s.pend.by !== p ? { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti } : null;
      let fx = null, asks = null; try { const r = resolveEffect(s, { i: x.i, c: x.c, when: "cast", seat: p, ...(d.st === "R" && on ? { on } : {}) }, [], true); if (r && r.ask) asks = r.ask.prompt; else fx = r; } catch (e) { console.warn(e); } const empty = !s.P[p].av.length && /Avatar[^:]*(ฝ่ายเรา|ของเรา|Zone\s*เรา)|เลือก\s*Avatar/.test(d.x || "");
      // React: only inside a matching window; scripted canCast: only when its condition holds
      const scx = scriptOf(s, x);
      const KIND_TH = { attack: "ตอนฝ่ายตรงข้ามประกาศโจมตี", summon: "ตอนฝ่ายตรงข้ามอัญเชิญ Avatar", cast: "ตอนฝ่ายตรงข้ามใช้ Magic" };
      // a React whose moment the game cannot check: the player may use it by hand on their own turn or in any response window
      const free = d.st === "R" && !scx && E.ext.reactFree && E.ext.reactFree(s, x); const byHand = free && (on ? true : E.canAct(s, p));
      const block = d.st === "R" ? (byHand ? null : free ? "ระบบตรวจเงื่อนไขของ React ใบนี้เองไม่ได้ ใช้เองได้ในเทิร์นของเรา หรือตอนที่มีกล่องให้ตอบโต้ขึ้นมา" : !on || !E.reactsFor(s, p, on).includes(x) ? `React ใช้ได้${scx && scx.react ? scx.react.kinds.map((k) => KIND_TH[k]).join(" หรือ ") : "ตอนฝ่ายตรงข้ามทำบางอย่าง"} (และตรงเงื่อนไขบนการ์ด) ตอนนั้นจะมีปุ่มขึ้นให้เอง` : null)
        : scx && scx.canCast && !scx.canCast(E, s, p) ? "ยังไม่ตรงเงื่อนไขการใช้การ์ดใบนี้" : null;
      if (block) return box(`${d.n}`, fxText(d.x || "", "small", "max-height:150px;overflow:auto"), h("div", { class: "small", style: "color:var(--warn)" }, block),
        h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { G.castFor = null; draw(); } }, "ปิด")));
      return box(`ใช้ ${SUB_TH[d.st]} Magic: ${d.n}?`, fxText(d.x || "ไม่มีข้อความ", "small", "max-height:150px;overflow:auto"),
        asks ? h("div", { class: "small", style: "color:#8ee3b2" }, "ใช้แล้วจะให้เลือก: " + asks) : fx ? h("div", { class: "small", style: "color:#8ee3b2" }, fx.explain) : h("div", { class: "tiny muted" }, "ระบบอ่านผลเองไม่ได้ ใช้แล้วจะให้เลือกว่าจะให้ชิเอลจัดการหรือจัดการเอง"),
        empty ? h("div", { class: "small", style: "color:var(--warn)" }, "ระวัง: ตอนนี้ยังไม่มี Avatar ฝ่ายเราบนสนาม ผลของการ์ดนี้อาจไม่มีเป้าหมาย") : null,
        byHand && (!on || !E.reactsFor(s, p, on).includes(x)) ? h("div", { class: "small", style: "color:var(--warn)" }, "ระบบตรวจเงื่อนไขของ React ใบนี้เองไม่ได้ ใช้เมื่อเงื่อนไขบนการ์ดครบจริงเท่านั้น") : null,
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
    const hp = G.helperPick; const ax = P.av.find((y) => y.i === hp.att); const helpers = ax ? P.av.map((y) => ({ y, hq: E.helpOf(s, p, ax, y) })).filter((z) => z.hq) : [];
    const risky = helpers.some((z) => z.hq.risky && hp.sup.includes(z.y.i));
    return box("เลือกผู้ช่วยโจมตี (สามัคคี / แทงหลัง)", h("div", { class: "pick" }, helpers.map(({ y, hq }) => { const b = cardBtn(E.def(s, y).im, { badge: "+" + hq.n + (hq.risky ? " ⚠" : ""), cls: hp.sup.includes(y.i) ? "sel" : "", onclick: () => { hp.sup = hp.sup.includes(y.i) ? hp.sup.filter((i) => i !== y.i) : [...hp.sup, y.i]; draw(); } }); if (hq.risky) b.title = "แทงหลังสีต่างกับผู้โจมตี: ผู้โจมตีจะถูกทำลายเมื่อจบการต่อสู้"; return b; })),
      risky ? h("div", { class: "tiny", style: "color:#ffb4a8" }, "⚠ ผู้ช่วยแทงหลังสีต่างกับผู้โจมตี: ผู้โจมตีจะถูกทำลายเมื่อจบการต่อสู้") : null,
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { G.helperPick = null; doAct({ type: "attack", i: hp.att, tk: hp.tk, ti: hp.ti, sup: hp.sup }, p); } }, "โจมตี"), h("button", { class: "btn", onclick: () => { G.helperPick = null; draw(); } }, "ยกเลิก")));
  }
  if (s.phase === "mull") {
    const n = (G.pick || []).length;
    return box("เปลี่ยนมือ (ทำได้ครั้งเดียว)", h("div", { class: "small muted" }, "แตะการ์ดบนมือที่ต้องการส่งกลับ Deck แล้วจั่วใหม่เท่าจำนวนนั้น"),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { const ids = G.pick || []; G.pick = null; doAct({ type: "mull", iids: ids }, p); } }, n ? `เปลี่ยน ${n} ใบ` : "เก็บมือเดิม")));
  }
  if (s.rw && s.rw.by !== p) {
    const L = E.locate(s, s.rw.i); const what = s.rw.kind === "battle" ? "เข้าสู่ Battle Phase" : s.rw.kind === "handed" ? "นำการ์ดจาก Deck ขึ้นมือ" : L ? `${s.rw.kind === "summon" ? "อัญเชิญ" : s.rw.kind === "activate" ? "ใช้ความสามารถของ" : s.rw.kind === "react" ? "ใช้ React" : "ใช้ Magic"} ${E.name(s, L.x)}` : "เล่นการ์ด";
    const rs = E.reactsFor(s, p, s.rw);
    const doomNames = s.rw.kind === "doom" ? (s.rw.ids || []).map((i) => E.locate(s, i)).filter(Boolean).map((D) => E.name(s, D.x)).join(", ") : "";
    return box(s.rw.kind === "destroyed" ? `${L ? E.name(s, L.x) : "Avatar"} ของคุณถูกทำลาย · จะใช้ React ไหม?` : s.rw.kind === "doom" ? `${doomNames} ของคุณ${s.rw.fight ? "แพ้การต่อสู้ และ" : ""}กำลังจะ${s.rw.kill.length || s.rw.killCs.length ? "ถูกทำลาย" : "ออกจากสนาม"} · จะใช้ React ไหม?` : s.rw.kind === "left" ? `${L ? E.name(s, L.x) : "Avatar"} ของคุณออกจาก Avatar Zone · จะใช้ React ไหม?` : `${s.P[s.rw.by].name} ${what} · จะใช้ React ตอบโต้ไหม?`, L ? h("div", { class: "row small" }, h("button", { class: "btn sm", onclick: () => cardView(L.x) }, "ดูการ์ดนั้น")) : null,
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
        return cardBtn(dd.im, { cls: (sel.includes(i) ? "sel" : "") + (can ? "" : " dim"), badge: L.z === "av" || L.z === "cs" ? "P" + E.power(s, L.x) : ZONE_TH[L.z], note: !can && a.why ? a.why[i] : null, onclick: () => { if (!can) return cardView(L.x); G.askSel = sel.includes(i) ? sel.filter((y) => y !== i) : need === 1 ? [i] : sel.length < need ? [...sel, i] : sel; draw(); } }); })),
      h("div", { class: "row" }, h("button", { class: "btn gold", disabled: !okN, onclick: () => { G.tpicks[a.idx] = G.askSel || []; G.ask = null; G.askSel = []; humanTrig(G.s, p); } }, "ยืนยัน"),
        a.optional ? h("button", { class: "btn", onclick: () => { G.tpicks[a.idx] = []; G.ask = null; G.askSel = []; humanTrig(G.s, p); } }, "ไม่เลือก") : null,
        h("button", { class: "btn sm", onclick: () => { G.ask = null; G.tmanual = true; draw(); } }, "จัดการเอง")));
  }
  if (s.trig.length && !G.tmanual && G.tk === s.trig[0].id) return box("กำลังทำงาน…", h("div", { class: "tiny muted" }, (s.cards[s.trig[0].c] || {}).n || ""));
  if (s.trig.length) {
    const t = s.trig[0]; const d = s.cards[t.c] || {}; const when = { summon: "จุติ", cast: "ใช้ Magic", life: "LIFE หงาย", death: "คำสั่งเสีย", attack: "เมื่อโจมตี", build: "ก่อสร้าง", manual: "สั่งใช้", activate: "สั่งใช้", paid: "ถูกทิ้งเป็นค่า Cost", milled: "ถูกธรณีสูบ", win: "ชนะการต่อสู้", end: "End Phase", mainStart: "เริ่ม Main Phase", attacked: "ถูกโจมตี", hostWin: "Avatar ที่สวมใส่ชนะการต่อสู้", summonedBy: "ถูกอัญเชิญด้วยความสามารถ", retarget: "เปลี่ยนเป้าหมายการโจมตี", stab: "ใช้แทงหลัง", afterFight: "หลังการต่อสู้", onShield: "ใช้โล่มนุษย์", lifeFlip: "LIFE ถูกหงาย", hostAttack: "Avatar ที่สวมใส่โจมตี", fight: "เมื่อต่อสู้", link: "เข้าสู่สถานะ Link", allyDeath: "Avatar ฝ่ายเราถูกทำลาย", lifeLater: "LIFE (Main Phase ถัดไป)" }[t.when] || t.when;
    const hint = h("input", { type: "text", placeholder: "บอกชิเอลถ้าต้องเลือกเป้าหมาย เช่น ทำลายพญานาค", "aria-label": "เป้าหมายที่ต้องการ" }); const out = h("div");
    const auto = null;
    return box(`เอฟเฟกต์: ${d.n} (${when})`,
      t.manualRest ? h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "small", style: "color:#8ee3b2" }, "ระบบทำส่วนแรกของเอฟเฟกต์ให้แล้ว เหลือส่วนนี้ที่ต้องทำเอง:"), fxText(t.manualRest, "small", "max-height:120px;overflow:auto;border-color:rgba(240,180,60,.5)")) : null,
      t.manualRest ? h("details", { class: "small" }, h("summary", { class: "muted" }, "ดูข้อความเต็มของการ์ด"), fxText(d.x || "", "small", "max-height:140px;overflow:auto")) : fxText(d.x || "", "small", "max-height:160px;overflow:auto"), Ciel.on() ? hint : null, out,
      auto ? h("div", { class: "small", style: "color:#8ee3b2" }, auto.explain) : h("div", { class: "tiny muted" }, t.manualRest ? "ใช้เครื่องมือ \"จัดการเอง\" ทำส่วนที่เหลือ แล้วกด เสร็จแล้ว (ถ้าเงื่อนไขไม่ครบ กด ข้าม)" : "การ์ดนี้ซับซ้อนเกินกว่าที่ระบบอ่านเองได้ ใช้ชิเอลหรือจัดการเองด้วยเครื่องมือ"),
      h("div", { class: "row" },
        auto ? h("button", { class: "btn gold sm", onclick: () => doAct({ type: "trig", id: t.id, explain: auto.explain, ops: auto.ops }, p) }, "ใช้ผลอัตโนมัติ") : null,
        h("button", { class: "btn ciel", disabled: !Ciel.on(), title: Ciel.on() ? "" : "ต้องใส่ API key", onclick: async (e) => { const btn = e.currentTarget; btn.disabled = true; out.replaceChildren(busy("ชิเอลกำลังอ่านการ์ด…")); try { const r = await cielResolve(s, t, hint.value); out.replaceChildren(h("div", { class: "small" }, r.explain || "ไม่มีผลที่ต้องทำ"), h("div", { class: "row" }, h("button", { class: "btn gold sm", onclick: () => doAct({ type: "trig", id: t.id, ...r }, p) }, "ใช้ผลนี้"))); } catch (err) { out.replaceChildren(h("div", { class: "small muted" }, aiErr(err))); } btn.disabled = false; } }, "ให้ชิเอลจัดการ"),
        h("button", { class: "btn sm", onclick: tools }, "จัดการเอง"), h("button", { class: "btn sm", onclick: () => doAct({ type: "trig", id: t.id, skip: false, ops: [], explain: "จัดการด้วยมือแล้ว" }, p) }, "เสร็จแล้ว"), h("button", { class: "btn sm", onclick: () => doAct({ type: "trig", id: t.id, skip: true }, p) }, "ข้าม")));
  }
  if (s.pend) {
    const moves = legalMoves(s, p); const reacts = P.hand.filter((x) => { const d = E.def(s, x); return d.t === "M" && d.st === "R" && !s.mu[p].R; });
    const att = E.locate(s, s.pend.att); const tgt = s.pend.tk === "life" ? "LIFE" : (E.locate(s, s.pend.ti) || { x: null }).x ? E.name(s, E.locate(s, s.pend.ti).x) : "?";
    const rs = E.reactsFor(s, p, { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti });
    return box(`ถูกโจมตี: ${att ? E.name(s, att.x) : "?"} (POWER ${att ? E.power(s, att.x) + (s.pend.bonus || 0) : 0}) → ${tgt}`,
      !rs.length && moves.length <= 1 ? h("div", { class: "tiny muted" }, "ไม่มี โล่มนุษย์ ที่ตื่นอยู่ และไม่มี React ที่ใช้ได้ตอนนี้ · รับการโจมตีให้อัตโนมัติ") : null,
      rs.length ? h("div", { class: "opts" }, rs.map((x) => h("button", { class: "btn sm ciel", onclick: () => doAct({ type: "cast", i: x.i }, p) }, "React: " + E.name(s, x)))) : null,
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
