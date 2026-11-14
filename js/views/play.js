import { h, clone, toast, openSheet, confirmBox, busy, lsGet, lsSet, lsDel, newId, sleep, holo } from "../util.js?v=20261114112449";
import { fxText, kwGloss } from "../fxtext.js?v=20261114112449";
import { card, deckToList, validateDeck, deckAce, deckStats, artImg, cardLine, TYPE_TH, SUB_TH, COLORS, colorOf, skinsFor, setGameSkins } from "../cards.js?v=20261114112449";
import { E, legalMoves, PHASE_TH, ZONE_TH, RuleError, scriptOf, uniqDeckActs } from "../engine.js?v=20261114112449";
import { H, Ciel, cielPick, cielResolve, cielCoach, aiErr } from "../ai.js?v=20261114112449";
import { Arena, animSetting, gfxSetting } from "../arena3d.js?v=20261114112449";
import { myFigure, myMat, myScene, mySleeve, mySigil, newlyEarned, rewardName, earned, ACH, deckLocked, boxGoalsFor, myWinFx } from "../achieve.js?v=20261114112449";
import { themeCounts, officialStarters } from "../boxdecks.js?v=20261114112449";
import { ladder, ladderReset } from "../ladder.js?v=20261114112449";
import { notify } from "../notify.js?v=20261114112449";
import { dayOf, dayQuests, stars, questsDoneBy, doneToday } from "../quests.js?v=20261114112449";
import { tourNow, tourPanel, newTour } from "../tour.js?v=20261114112449";
import { puzzleState, solveTurn } from "../puzzles.js?v=20261114112449";
import { autoEffect, resolveEffect, reactTiming, activations } from "../effects.js?v=20261114112449";
import { Music, MUSIC_STYLES } from "../music.js?v=20261114112449";
import { Sfx } from "../sfx.js?v=20261114112449";
import { Data, Me, F, db, gameRef, newGameId, watchLobby, watchPlaying, saveMatch, myName, myAvatar } from "../fb.js?v=20261114112449";
import { Views, cardBtn, showCard, avatarEl } from "../ui.js?v=20261114112449";
import { readAura, traits } from "../auras.js?v=20261114112449";
import { openAsk, openReport, addAskContext, isOwner } from "./ask.js?v=20261114112449";
// a readable snapshot of the game for questions asked to Ciel from inside the app
addAskContext(() => { if (!G || !G.s || !location.hash.startsWith("#play")) return null; const s = G.s, V = G.V; const me = s.P[V], op = s.P[1 - V];
  const av = (P) => P.av.map((x) => `${E.name(s, x)} P${E.power(s, x)}${x.a ? "" : " (นอน)"}`).join(", ") || "-";
  return { game: [`เทิร์น ${s.turn} · ${PHASE_TH[s.phase] || s.phase} · ตาของ ${s.P[s.active].name}`, `เด็คเรา: ${me.deckName || "-"} · เด็คคู่แข่ง: ${op.deckName || "-"}`,
    `LIFE เรา ${me.life.filter((x) => !x.up).length}/${me.life.length} · คู่แข่ง ${op.life.filter((x) => !x.up).length}/${op.life.length}`, `มือเรา: ${me.hand.map((x) => E.name(s, x)).join(", ") || "-"}`,
    `สนามเรา: ${av(me)}`, `สนามคู่แข่ง: ${av(op)}`, `Deck เรา ${me.deck.length} · นรกเรา ${me.hell.length} · มือคู่แข่ง ${op.hand.length} ใบ`, "ล่าสุด: " + s.log.slice(-8).map((l) => l.m).join(" / "),
    ...(s.id ? [`รีเพลย์ในเครื่องนี้: ${s.id}-${V}`] : []), "บันทึก 40 บรรทัดล่าสุด:\n" + s.log.slice(-40).map((l) => "· " + l.m).join("\n"), // so a report can be traced back to its game
    ...(() => { const u = Object.entries(lsGet(UNREAD, {})); return u.length ? ["ความสามารถที่ระบบยังทำให้ไม่ได้: " + u.slice(0, 12).map(([k, v]) => `${k} ×${v.times}`).join(", ")] : []; })()].join("\n") }; });
import { allDecks, deckById } from "./decks.js?v=20261114112449";
import { customMat, customSleeve, customFig, customStand, setOnReady, onVault } from "../vault.js?v=20261114112449";
// the players' own mat picture, card sleeve and figure (vault.js): the table asks for them, and redraws when one loads or changes
Arena.setCustom({ mat: customMat, sleeve: customSleeve, fig: customFig, stand: customStand, skins: (s) => setGameSkins(s && s.P, Me.uid) }); setOnReady((o) => Arena.customReady(o)); onVault(() => Arena.refreshCustom());
{ let sig = ""; Data.listeners.add(() => { const sh = Data.meta && Data.meta.show, now = sh ? Object.entries(sh).map(([k, x]) => k + ":" + (x && x.v) + ":" + (x && x.finish)).join() : ""; if (now !== sig) { sig = now; Arena.refreshCustom(); } }); }

const SAVE = "bot.game";
const Setup = lsGet("bot.setup", { mode: "bot", deck: "", opp: "random", brain: "ciel" });
let G = null; // live game

// who must act now
function whoActs(s) {
  if (s.phase === "over") return null;
  if (s.phase === "toss") return E.tossSeat(s);
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
    const decks = allDecks().filter((d) => validateDeck(d).ok && !deckLocked(d));
    const mineDecks = decks.filter((d) => d.owner === Me.uid || d.starter);
    if (!mineDecks.some((d) => d.id === Setup.deck)) Setup.deck = (mineDecks[0] || {}).id || "";
    const save = () => lsSet("bot.setup", Setup);
    const preview = h("div"); const right = h("div", { class: "stack" }); let lobbyUnsub = null;
    // the way into the game stays in reach at the foot of the screen, whatever the page is scrolled to: who meets whom, and the button
    const bar = h("div", { class: "startbar", hidden: true });
    const draw = () => {
      const d = deckById(Setup.deck); const ace = d && deckAce(d);
      preview.replaceChildren(d ? h("section", { class: "hero", style: "min-height:200px" }, ace ? artImg(ace, "", "") : null, h("div", { class: "wash" }), h("div", { class: "in" }, h("span", { class: "eyebrow" }, "เด็คของคุณ"), h("h2", { style: "margin:0" }, d.name), h("div", { class: "small muted" }, ace ? "เอซ: " + ace.n : ""), goalLine(d), h("div", { class: "row" }, h("a", { class: "btn sm", href: "#decks/view/" + d.id }, "ดูเด็ค")))) : h("div", { class: "empty" }, "ยังไม่มีเด็คที่ถูกกติกา ไปที่หน้าเด็คเพื่อจัด หรือคัดลอก Starter Deck"),
        mineDecks.length ? deckShelf(mineDecks, "deck", draw) : null);
      if (lobbyUnsub) { lobbyUnsub(); lobbyUnsub = null; }
      const modeBtn = (k, t, s) => h("button", { class: "mode", "aria-pressed": Setup.mode === k ? "true" : "false", onclick: () => { Setup.mode = k; save(); draw(); } }, h("b", null, t), h("span", null, s));
      const body = h("div", { class: "stack" }); let go = null;
      if (Setup.mode === "bot") {
        body.append(h("div", { class: "stack", style: "gap:4px" }, h("span", { class: "small muted" }, "เด็คของบอท"), deckShelf(decks, "opp", draw, true)),
          h("div", { class: "row" }, h("span", { class: "small muted" }, "สมองบอท"), h("div", { class: "seg", role: "group", "aria-label": "สมองบอท" }, [["easy", "ง่าย"], ["basic", "ปกติ"], ["hard", "เก่ง"], ["ciel", "ชิเอล"]].map(([k, t]) => h("button", { "aria-pressed": Setup.brain === k ? "true" : "false", onclick: () => { Setup.brain = k; save(); draw(); } }, t)))),
          h("div", { class: "tiny muted" }, Setup.brain === "ciel" ? (Ciel.on() ? "ชิเอลคิดทุกจังหวะและอ่านเอฟเฟกต์การ์ดให้ (ใช้ API key ของคุณ)" : "ยังไม่ได้ใส่ API key จะใช้บอทระดับปกติแทน") : BOT_LEVEL[Setup.brain] ? BOT_LEVEL[Setup.brain].about : BOT_LEVEL.basic.about),
        );
        { const o = Setup.opp !== "random" && deckById(Setup.opp); go = { t: "เริ่มดวล", fn: () => startLocal("bot"), need: true, vs: (o && !deckLocked(o) ? o.name : "Starter Deck แบบสุ่ม") + " · " + (Setup.brain === "ciel" && Ciel.on() ? "ชิเอล" : (BOT_LEVEL[Setup.brain] || BOT_LEVEL.basic).name) }; }
      } else if (Setup.mode === "learn") {
        body.append(h("div", { class: "small" }, "เกมสอนเล่นใช้ Starter Deck 01 สู้กับบอทที่ใช้ Starter Deck 02 ระหว่างเล่นจะมีคำอธิบายขึ้นทีละเรื่องเมื่อถึงจังหวะนั้นในเกม เช่น การจ่าย GEM การโจมตี และ LIFE"),
          h("div", { class: "tiny muted" }, "กติกาตาม Rule Book 3.2 เหมือนเกมจริงทุกอย่าง ปิดคำอธิบายได้ทุกเมื่อ"));
        go = { t: "เริ่มสอนเล่น", fn: startLearn, name: "Starter Deck 01", vs: "Starter Deck 02 · บอท" };
      } else if (Setup.mode === "gauntlet") {
        const steps = gauntletSteps(), next = steps.findIndex((g) => !g.done);
        body.append(h("div", { class: "small" }, "เอาชนะ Starter Deck ทางการทีละด่าน บอทเก่งขึ้นเรื่อย ๆ ใช้เด็คของคุณที่เลือกไว้ด้านบน (Hearthstone และ Master Duel มีโหมดฝึกแบบนี้)"),
          h("div", { class: "stack", style: "gap:6px" }, steps.map((g, k) => h("div", { class: "mrow", style: "cursor:default" }, h("span", { class: "chip " + (g.done ? "good" : k === next ? "gold" : "") }, g.done ? "✓" : String(k + 1)),
            h("div", { class: "grow", style: "min-width:0" }, h("b", null, g.deck.name), h("div", { class: "tiny muted" }, (BOT_LEVEL[g.brain] || {}).name || g.brain)),
            g.done || k === next ? h("button", { class: "btn sm" + (k === next ? " gold" : ""), onclick: () => startGauntlet(k) }, g.done ? "เล่นอีก" : "ท้าดวล") : h("span", { class: "tiny muted" }, "ยังไม่ถึง")))),
          h("div", { class: "tiny muted" }, next < 0 ? "ผ่านครบทุกด่านแล้ว" : `ผ่านแล้ว ${steps.filter((g) => g.done).length}/${steps.length} ด่าน · ด่านที่ผ่านแล้วเล่นซ้ำได้`));
        if (next >= 0) go = { t: `ท้าดวลด่าน ${next + 1}`, fn: () => startGauntlet(next), need: true, vs: `${steps[next].deck.name} · ${(BOT_LEVEL[steps[next].brain] || {}).name}` };
      } else if (Setup.mode === "goldfish") {
        body.append(h("div", { class: "small" }, "คู่แข่งเป็นหุ่นซ้อมที่ไม่ลงการ์ดและไม่ตอบโต้เลย ใช้ดูว่าเด็คนี้ออกตัวได้แค่ไหนและชนะได้เร็วสุดเทิร์นไหน"),
          h("div", { class: "tiny muted" }, "เราเล่นก่อนทุกเกม ผลจะเก็บแยกในประวัติ ไม่นับรวมอัตราชนะ และย้อนตาได้"));
        go = { t: "เริ่มซ้อม", fn: () => startLocal("goldfish"), need: true, vs: "หุ่นซ้อม" };
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
        body.append(h("div", { class: "stack", style: "gap:4px" }, h("span", { class: "small muted" }, "เด็คฝั่งที่ 2"), deckShelf(decks, "opp", draw, true)),
          h("div", { class: "tiny muted" }, "ควบคุมทั้งสองฝั่งเอง เหมาะกับลองคอมโบหรือเล่นกับเพื่อนบนเครื่องเดียวกัน"));
        { const o = Setup.opp !== "random" && deckById(Setup.opp); go = { t: "เริ่มเกม", fn: () => startLocal("solo"), need: true, vs: (o && !deckLocked(o) ? o.name : "Starter Deck แบบสุ่ม") + " · ฝั่งที่ 2" }; }
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
      right.replaceChildren(h("div", { class: "modes" }, modeBtn("bot", "ดวลกับบอท", "ซ้อมมือกับชิเอล"), modeBtn("friend", "ดวลกับเพื่อน", "ออนไลน์ผ่านห้อง"), modeBtn("solo", "เล่นสองฝั่ง", "ทดลองคอมโบเอง"), modeBtn("goldfish", "ซ้อมมือเดียว", "วัดว่าเด็คชนะเร็วแค่ไหน"), modeBtn("puzzle", "โจทย์ปริศนา", "หาทางชนะในเทิร์นเดียว"), modeBtn("gauntlet", "ไต่ด่าน", "เอาชนะเด็คทางการทีละด่าน"), modeBtn("learn", "สอนเล่น", "เรียนกติกาทีละขั้น")), h("div", { class: "panel" }, body));
      bar.hidden = !go;
      bar.replaceChildren(...(go ? [h("div", { class: "sbtxt" }, h("b", null, go.name || (d ? d.name : "ยังไม่ได้เลือกเด็ค")), h("span", { class: "tiny muted" }, "พบ " + go.vs)),
        h("button", { class: "btn gold lg", disabled: !!go.need && !d, onclick: go.fn }, go.t)] : []));
    };
    root.replaceChildren(h("div", { class: "pagehead" }, h("div", null, h("h1", null, "สนามดวล"), h("div", { class: "muted small" }, "เล่นตาม Rule Book 3.2 · ความสามารถของการ์ดทำงานให้อัตโนมัติ")),
      saved && saved.s && saved.s.phase !== "over" ? h("button", { class: "btn ciel", onclick: () => resume(saved) }, `เล่นต่อ: ${saved.s.P[saved.V || 0].deckName} · เทิร์น ${saved.s.turn}`) : null),
      h("div", { class: "setup" }, h("div", { class: "stack" }, preview, h("div", { class: "questwrap" }, questPanel())), right), bar);
    draw();
    this._unsubLobby = () => lobbyUnsub && lobbyUnsub();
  },

  mountGame(root) {
    if (this._unsubLobby) this._unsubLobby();
    document.body.classList.add("arena-on");
    const stage = h("div", { id: "arena" }); const hud = h("div", { class: "hud" }); G.hud = hud;
    // a phone turned sideways leaves the table a thin strip under the hand: suggest turning it upright (it can still be played)
    let side = false; try { side = sessionStorage.getItem("bot.landok") === "1"; } catch { /* storage may be off */ }
    const rot = h("div", { class: "rotatehint", role: "dialog", "aria-label": "หมุนมือถือ", hidden: side },
      h("div", { class: "rotph", "aria-hidden": "true" }), h("b", null, "หมุนมือถือเป็นแนวตั้ง"), h("span", { class: "muted small" }, "สนามบนมือถือจัดไว้สำหรับแนวตั้ง การ์ดจะใหญ่และกดง่ายกว่า"),
      h("button", { class: "btn sm", onclick: (e) => { try { sessionStorage.setItem("bot.landok", "1"); } catch { /* storage may be off */ } e.currentTarget.closest(".rotatehint").hidden = true; } }, "เล่นแนวนอนต่อ"));
    root.replaceChildren(stage, h("div", { class: "vign" }), hud, rot);
    Arena.setQuiet(!!(G.watch || G.replay));
    if (gfxSetting() !== "flat") try { Arena.mount(stage, { mat: myMat(), scene: myScene(), winfx: myWinFx(), watch: !!G.watch }); } catch (e) { console.warn("3D off", e); } // "แบบเรียบ 2D" in the settings: no 3D at all
    G.flat = Arena.on ? null : h("div", { class: "flatboard", role: "group", "aria-label": "สนาม" }); if (G.flat) stage.append(G.flat); // no 3D here: the flat table
    Arena.setHover((i) => { if (G.hover === i) return; G.hover = i; if (G.muteHover != null && i !== G.muteHover) G.muteHover = null; drawInspector(); });
    Arena.setClick(fieldClick); Arena.setDrag(onDrag);
    // the flat table (no 3D): the same drag, from one card button to another
    if (G.flat) {
      const at = (e) => { const b = document.elementFromPoint(e.clientX, e.clientY); const c = b && b.closest && b.closest(".fcard"); return c ? +c.dataset.i : b && b.closest && b.closest(".fmid .gold") ? "life" : null; };
      let fd = null; const flat = G.flat; // (an attacker card takes touch drags itself: .fcard.drag in the CSS)
      flat.addEventListener("pointerdown", (e) => { if (e.button) return; const i = at(e); fd = { x: e.clientX, y: e.clientY, i, moved: false }; onDrag("start", i, e); });
      flat.addEventListener("pointermove", (e) => { if (!fd) return; if (!fd.moved && Math.hypot(e.clientX - fd.x, e.clientY - fd.y) > 14) { fd.moved = true; try { flat.setPointerCapture(e.pointerId); } catch { /* not capturable */ } } if (fd.moved) onDrag("move", fd.i, e); });
      flat.addEventListener("pointerup", (e) => { const d = fd; fd = null; if (!d || !d.moved) return; onDrag("drop", d.i, e, at(e)); });
      flat.addEventListener("pointercancel", () => { fd = null; onDrag("cancel"); });
    }
    // right-click a card on the table: the whole card in a sheet that scrolls (long effects included)
    stage.addEventListener("contextmenu", (e) => { const L = G && G.s && G.hover != null && E.locate(G.s, G.hover); if (!L) return; e.preventDefault(); G.hover = null; drawInspector(); cardView(L.x); });
    Arena.update(G.s, view(), { reset: true });
    Music.start(); draw(); Arena.refit(); drive();
    clearInterval(G.dog); G.dog = setInterval(watchdog, 1500);
    if (G.mode === "friend") { clearInterval(G.idleTick); const g = G; G.idleTick = setInterval(() => { if (G !== g) return clearInterval(g.idleTick); const idle = oppIdle() > IDLE_MS; if (idle !== !!G.idleShown) { G.idleShown = idle; draw(); } }, 5000); }
  },
};

// the decks as boxes on a shelf, each with its ace card on the front: a deck is picked by its box, as from the deck
// boxes on a table. Grouped by where the deck comes from; the other side's shelf starts with a "random Starter" box
function deckShelf(list, key, redraw, random) {
  const groups = [["สุ่ม", () => false], ["เด็คของฉัน", (d) => d.owner === Me.uid && !d.starter], ["ชิเอลจัดให้", (d) => d.ciel], ["เด็คกล่อง", (d) => d.box && !d.ciel],
    ["Starter Deck ทางการ", (d) => d.starter && !d.ciel && !d.box], ["ของเพื่อน", (d) => !d.starter && d.owner !== Me.uid]];
  const pick = (id) => { Setup[key] = id; lsSet("bot.setup", Setup); redraw(); };
  const box = (d) => {
    const id = d ? d.id : "random", on = (Setup[key] || "") === id, ace = d && deckAce(d);
    const cols = d ? Object.entries(deckStats(d).colors).filter(([k]) => COLORS.includes(k)).sort((a, b) => b[1] - a[1]).map(([k]) => colorOf(k)) : [];
    const band = cols.length ? `background:linear-gradient(90deg,${cols.join(",")}${cols.length === 1 ? "," + cols[0] : ""})` : "";
    return h("button", { class: "dbx" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false", title: d ? d.name + (ace ? " · เอซ: " + ace.n : "") : "สุ่มจาก Starter Deck", onclick: () => pick(id) },
      h("span", { class: "dbox", "aria-hidden": "true" }, h("span", { class: "dface" }, ace ? artImg(ace, "", "") : h("b", { class: "dq" }, "?")), h("span", { class: "dband", style: band })),
      h("span", { class: "dname" }, d ? d.name : "สุ่ม Starter"));
  };
  const rows = groups.map(([t, f], k) => [t, k === 0 ? (random ? [null] : []) : list.filter(f)]).filter(([, l]) => l.length);
  const el = h("div", { class: "shelf", role: "radiogroup", "aria-label": key === "deck" ? "เลือกเด็คของคุณ" : "เลือกเด็คของอีกฝั่ง" },
    rows.map(([t, l]) => h("div", { class: "shelfgrp" }, h("div", { class: "tiny muted" }, t), h("div", { class: "shelfrow" }, l.map(box)))));
  // the picked box in view inside its own row (a long row scrolls sideways; the page itself does not move)
  requestAnimationFrame(() => { const on = el.querySelector(".dbx.on"), row = on && on.parentElement; if (row && (on.offsetLeft + on.offsetWidth > row.scrollLeft + row.clientWidth || on.offsetLeft < row.scrollLeft)) row.scrollLeft = Math.max(0, on.offsetLeft - 8); });
  return el;
}
// today's three quests, the stars so far and what the next stars open (see quests.js)
function questPanel() {
  const list = dayQuests(dayOf(Date.now())), n = stars(), next = ACH.filter((a) => /^stars/.test(a.id)).map((a) => ({ a, need: a.prog()[1] })).find((x) => n < x.need);
  return h("section", { class: "panel stack quests", "aria-label": "ภารกิจวันนี้" },
    h("div", { class: "row", style: "justify-content:space-between" }, h("b", null, "ภารกิจวันนี้"), h("span", { class: "chip gold" }, `★ ${n} ดาว`)),
    list.map(({ q, have, done }) => h("div", { class: "qrow" + (done ? " done" : "") }, h("span", { class: "qmark", "aria-hidden": "true" }, done ? "★" : "☆"), h("span", { class: "grow" }, q.t), h("span", { class: "tiny num" }, done ? "สำเร็จ" : `${have}/${q.n}`))),
    h("div", { class: "tiny muted" }, (next ? `อีก ${next.need - n} ดาว ได้${rewardName(next.a.gives)} · ` : "") + "ภารกิจใหม่ทุกเที่ยงคืน ทุกคนได้ภารกิจเดียวกัน"));
}
// ---------- start / resume ----------
const pickOpp = () => { const o = Setup.opp !== "random" && deckById(Setup.opp); if (o && !deckLocked(o)) return o; const st = allDecks().filter((d) => d.starter && !d.box); return st[Math.floor(Math.random() * st.length)]; };
const pack = (d) => ({ ...deckToList(d), name: d.name, id: d.id });
// ไต่ด่าน: the official Starter Decks one after another, the bot growing stronger; a step is passed by a win recorded with its number
function gauntletSteps() { const lv = (k, n) => (k < 2 ? "easy" : k < Math.ceil(n * 0.6) ? "basic" : "hard"); const list = officialStarters().filter((d) => validateDeck(d).ok);
  return list.map((deck, k) => ({ deck, brain: lv(k, list.length), done: Data.matches.some((m) => m.gs === k + 1 && m.result === "win") })); }
function startGauntlet(k) { const g = gauntletSteps()[k]; if (!g) return; const keep = [Setup.opp, Setup.brain]; Setup.opp = g.deck.id; Setup.brain = g.brain;
  try { startLocal("bot"); } finally { [Setup.opp, Setup.brain] = keep; } if (G && G.s) { G.gs = k + 1; persist(); } }
// a win with this deck would open a box deck: say which (on the setup screen, under the chosen deck)
const goalLine = (d) => { const gs = boxGoalsFor(d); return gs.length ? h("div", { class: "goalline small" }, "ชนะด้วยเด็คนี้ ปลดล็อค " + gs.map((a) => rewardName(a.gives).replace(/^เด็คกล่องพิเศษ /, "")).join(" และ ")) : null; };
// the bot's own side of the table: red lacquer (black when ours is red, so the two halves always differ)
const botMat = () => (myMat() === "red" ? "black" : "red");
function startLocal(mode) {
  // goldfish (ซ้อมมือเดียว): the other side is a training dummy that never plays a card, so the game shows how fast this deck can win
  const fish = mode === "goldfish"; const me = deckById(Setup.deck), op = fish ? me : pickOpp(); if (!me || !op) return toast("เลือกเด็คก่อน");
  const botName = Setup.brain === "ciel" && Ciel.on() ? "ชิเอล" : (BOT_LEVEL[Setup.brain] || BOT_LEVEL.basic).name;
  const init = { players: [{ uid: Me.uid, name: myName(), ava: myAvatar(), av3: myFigure(), sig: mySigil(), mat: myMat(), sleeve: mySleeve(), skins: skinsFor(me) }, fish ? { name: "หุ่นซ้อม", bot: true, mat: botMat() } : mode === "bot" ? { name: botName, bot: true, av3: myFigure() ? "chang" : "", mat: botMat() } : { uid: Me.uid, name: "ฝั่งที่ 2", mat: botMat(), skins: skinsFor(op) }], decks: [pack(me), pack(op)], seed: (Math.random() * 2 ** 31) | 0, first: 0, toss: !fish, mode: fish ? "bot" : mode };
  const s = E.newGame(init);
  G = { s, V: 0, mode: fish ? "bot" : mode, fish, brain: fish ? "goldfish" : mode !== "bot" ? "basic" : Setup.brain === "ciel" ? (Ciel.on() ? "ciel" : "basic") : BOT_LEVEL[Setup.brain] ? Setup.brain : "basic", id: s.id, saved: false, rec: { init: { ...init, id: s.id }, acts: [] } };
  persist(); go();
}
function startLearn() {
  const st = allDecks().filter((d) => d.starter && !d.box); const me = st.find((d) => d.id === "starter-sd01") || st[0], op = st.find((d) => d.id === "starter-sd02") || st[1]; if (!me || !op) return toast("ไม่พบ Starter Deck");
  const init = { players: [{ uid: Me.uid, name: myName(), ava: myAvatar(), av3: myFigure(), sig: mySigil(), mat: myMat(), sleeve: mySleeve(), skins: skinsFor(me) }, { name: "บอท", bot: true, av3: myFigure() ? "chang" : "", mat: botMat() }], decks: [pack(me), pack(op)], seed: 20261111, first: 0, mode: "bot" };
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
function persist() { if (!G || G.replay || G.watch) return; if (G.mode === "friend") lsSet(SAVE, { mode: "friend", id: G.id, V: G.V, s: G.s }); else lsSet(SAVE, { s: G.s, V: G.V, mode: G.mode, brain: G.brain, id: G.id, learn: G.learn || null, rec: G.rec || null, puzzle: G.puzzle || null, gs: G.gs || null }); }
function stopGame(clear) {
  if (!G) return; if (G.unsub) G.unsub(); if (clear) { if (!G.watch) lsDel(SAVE); } else persist(); // a watcher never touches their own saved game
  if (G.mode === "friend" && !G.watch && G.s && G.s.phase === "over") trimGame(G.id, G.s);
  clearInterval(G.idleTick); clearInterval(G.dog); Arena.unmount(); Music.stop(); setGameSkins(null); document.body.classList.remove("arena-on", "tossing"); document.querySelectorAll(".banner,.dmg,.emo,.showcase,.flatfx,.fxcuts,.dragghost,#atkarrow,#foearrow").forEach((e) => e.remove()); G = null;
}
// ---------- friends ----------
// Rule Book 3.2 (Deck Set 3): a card marked "ลำเอียง" cannot go in a Deck used in a competition, so tournament matches turn such a Deck away (other games play it as usual)
const BIASED_TOUR = "แมตช์ทัวร์นาเมนต์ใช้เด็คที่มีการ์ดลำเอียงไม่ได้ (Rule Book: การ์ดลำเอียงใส่ใน Deck ที่ใช้แข่งขันไม่ได้) เลือกเด็คอื่นก่อนนะ";
const biasedDeck = (d) => !!d && validateDeck(d).items.some((x) => x.warn && /ลำเอียง/.test(x.msg));
async function createRoom(extra = {}) { // extra: a tournament match ({ tour, vs, vsName }) only that friend may join
  const me = deckById(Setup.deck); if (!me) return;
  if (extra.tour && biasedDeck(me)) { toast(BIASED_TOUR, "bad"); return; }
  const id = newGameId();
  await F.setDoc(gameRef(id), { status: "waiting", host: Me.uid, hostName: myName(), hostAva: myAvatar(), hostAv3: myFigure(), hostSig: mySigil(), hostMat: myMat(), hostSleeve: mySleeve(), hostSkins: skinsFor(me), hostDeck: pack(me), seats: [Me.uid], createdAt: Date.now(), updatedAt: Date.now(), ...extra });
  toast("สร้างห้องแล้ว รอเพื่อนเข้าร่วม"); openOnline(id, 0);
}
async function joinRoom(r) {
  const me = deckById(Setup.deck); if (!me) return;
  if (r.tour && biasedDeck(me)) { toast(BIASED_TOUR, "bad"); return; }
  try {
    await F.runTransaction(db, async (tx) => {
      const snap = await tx.get(gameRef(r.id)); const g = snap.data(); if (!g || g.status !== "waiting") throw new Error("ห้องนี้เริ่มไปแล้ว"); if (g.vs && g.vs !== Me.uid) throw new Error("ห้องนี้เป็นแมตช์ทัวร์ของเพื่อนคนอื่น");
      const s = E.newGame({ players: [{ uid: g.host, name: g.hostName, ava: g.hostAva || "", av3: g.hostAv3 || "", sig: g.hostSig || "", mat: g.hostMat || "", sleeve: g.hostSleeve || "", skins: g.hostSkins || null }, { uid: Me.uid, name: myName(), ava: myAvatar(), av3: myFigure(), sig: mySigil(), mat: myMat(), sleeve: mySleeve(), skins: skinsFor(me) }], decks: [g.hostDeck, pack(me)], seed: (Math.random() * 2 ** 31) | 0, first: 0, toss: true, mode: "friend", id: r.id });
      tx.update(gameRef(r.id), { status: "playing", guest: Me.uid, guestName: myName(), seats: [g.host, Me.uid], state: JSON.stringify(s), updatedAt: Date.now() });
    });
    openOnline(r.id, 1);
  } catch (e) { toast(e.message || "เข้าร่วมไม่ได้", "bad"); }
}
// rematch with the same friend: open a room only they may join, and leave a note on the finished game for them
async function friendRematch() {
  const g = G, s = g.s, V = g.V, opp = s.P[1 - V]; const deck = deckById(s.P[V].deckId) || deckById(Setup.deck); if (!deck) return toast("เลือกเด็คก่อน");
  const id = newGameId();
  try { await F.setDoc(gameRef(id), { status: "waiting", host: Me.uid, hostName: myName(), hostAva: myAvatar(), hostAv3: myFigure(), hostSig: mySigil(), hostMat: myMat(), hostSleeve: mySleeve(), hostSkins: skinsFor(deck), hostDeck: pack(deck), seats: [Me.uid], createdAt: Date.now(), updatedAt: Date.now(), vs: opp.uid, vsName: opp.name });
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
  notify("ถึงตาคุณแล้ว", s.phase === "toss" ? "เสี่ยงทายว่าใครได้เลือกเริ่มก่อน" : s.phase === "mull" ? "เลือกเปลี่ยนการ์ดบนมือ" : s.pend ? `${op} โจมตี เลือกการตอบโต้` : s.active === V ? `เทิร์น ${s.turn} ของคุณ` : "มีเอฟเฟกต์ให้เลือก", "bot-game");
}
// ---------- watching a friend's game: the same table, read only, both hands face down ----------
function flipWatch() { if (!G || !G.watch || !G.s) return; G.V = 1 - G.V; G.pcMe = G.pcOp = undefined; G.sel = G.hover = null; Arena.update(G.s, G.V, { reset: true, flush: true }); draw(); }
const watchHand = (P) => h("div", { class: "watchhand glass", "aria-label": `มือของ ${P.name} ${P.hand.length} ใบ` }, h("span", { class: "small" }, `มือของ ${P.name}`), h("div", { class: "backs" }, P.hand.slice(0, 12).map(() => h("i"))), h("b", null, P.hand.length));
// ---------- emotes: short friendly lines, shown by the player who sent them (and their 3D figure acts them out) ----------
const EMOTES = [["hi", "สวัสดี 👋"], ["glhf", "ขอให้สนุกนะ"], ["wow", "ว้าว!"], ["gg", "เก่งมาก!"], ["oops", "อุ๊ย!"], ["think", "ขอคิดแป๊บ 🤔"], ["ty", "ขอบคุณนะ"], ["ggwp", "GG เกมดี!"],
  ["love", "ชอบมาก ❤"], ["angry", "ไม่ยอมนะ! 💢"], ["pout", "งอนแล้วนะ 😤"], ["cry", "ฮือ… 😭"]];
const EMO_TH = Object.fromEntries(EMOTES);
const BOT_REPLY = { hi: "hi", glhf: "glhf", gg: "ty", ty: "hi", ggwp: "ggwp", wow: "ty", love: "ty", pout: "oops" }; // the bot answers a greeting or a compliment
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
  Arena.emote(p, k); Sfx.play("click");
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
  const copy = G.rec ? JSON.parse(JSON.stringify(a)) : null; const before = stateSig(G.s);
  try { E.apply(G.s, a, p); } catch (e) {
    toast(e.message, "bad");
    // it broke part way through (a rule was refused before anything happened otherwise): keep what it did, in the record
    // too so the replay goes the same way, show the table as it now is and let the game carry on
    if (stateSig(G.s) !== before) { if (G.rec) G.rec.acts.push([p, { ...copy, __fail: 1 }]); persist(); Arena.update(G.s, view()); draw(); setTimeout(drive, 50); }
    return false;
  }
  if (G.rec) G.rec.acts.push([p, copy]);
  if (G.puzzle && mine(p)) G.say = null; // an old hint no longer fits
  if (fromHand) flyFromHand(a.i);
  // the other side's move (a bot answering our attack) keeps the attacker we are already aiming with, while it can still attack
  const aim = !mine(p) && G.att != null && E.locate(G.s, G.att), keepAim = !!aim && aim.z === "av" && aim.x.a && aim.p === G.s.active;
  G.pick = null; G.att = keepAim ? G.att : null; G.host = null; G.payFor = null; G.payVia = null; G.callVia = null; G.helperPick = null; G.castFor = null; persist();
  if (a.type === "attack") { G.sel = null; Arena.select(null); } // nothing pops open after an attack: the table stays clear for the next one
  if (G.coach && (G.coachLocal || G.s.turn !== G.coachTurn)) G.coach = null; // a hint is for the moment it was asked (Ciel's advice: for that turn)
  Arena.update(G.s, view()); draw(); drive();
  return true;
}
const stateSig = (s) => [s.log.length, s.trig.length, s.phase, s.turn, s.rw ? 1 : 0, s.pend ? 1 : 0, ...s.P.flatMap((P) => [P.hand.length, P.av.length, P.cs.length, P.mg.length, P.hell.length, P.deck.length, P.life.filter((y) => y.up).length])].join(",");
// nothing stays stuck: a bot that should act and is not thinking gets nudged, an own effect nobody started gets started,
// and an own effect still "working" after a few seconds (most of a minute while Ciel reads it) offers to let the system
// choose for it or to skip it
function watchdog() {
  if (!G || !G.s || G.replay || G.watch) return; const s = G.s; if (s.phase === "over") return;
  const t = s.trig[0], key = stateSig(s) + ":" + (t ? t.id : "");
  if (G.dogKey !== key) { G.dogKey = key; G.dogAt = Date.now(); G.stuck = null; return; }
  const idle = Date.now() - G.dogAt, p = whoActs(s); if (p == null) return;
  if (G.mode !== "friend" && isBot(s, p)) { if (!G.driving && idle > 5000) { G.dogAt = Date.now(); drive(); } return; }
  if (!t || s.rw || !mine(p) || t.seat !== p || G.lock) return;
  if (G.tk !== t.id) { if (idle > 2000) { G.dogAt = Date.now(); drive(); } return; }
  if (!G.ask && G.stuck !== t.id && idle > (G.tbusy ? 45000 : 4000)) { G.stuck = t.id; draw(); }
}
// the buttons out of an effect that cannot go on by itself: the system makes the card's choices, or the effect is skipped
function trigEscape(s, t, p, note) {
  const reset = () => { G.ask = null; G.askSel = []; G.tbusy = false; G.thinking = null; G.tk = null; };
  const auto = () => { reset(); let r = null; try { r = resolveEffect(s, t); } catch (err) { console.warn(err); }
    doAct(r && r.ops ? { type: "trig", id: t.id, explain: r.explain, ops: r.ops } : { type: "trig", id: t.id, skip: true }, p).then((ok) => { if (!ok) trigFailed(s, t, p); }); };
  const skip = () => { reset(); doAct({ type: "trig", id: t.id, skip: true }, p); };
  return [h("div", { class: "small muted" }, note), h("div", { class: "row" }, h("button", { class: "btn gold", onclick: auto }, "ให้ระบบเลือกให้"), h("button", { class: "btn", onclick: skip }, "ข้ามเอฟเฟกต์"))];
}
// an own effect whose result could not be carried out: skipped, so the game goes on (whatever it already did stays)
function trigFailed(s, t, p) {
  if (!G || G.s !== s || G.mode === "friend") return;
  if (s.trig.some((x) => x.id === t.id)) { try { E.apply(s, { type: "trig", id: t.id, skip: true }, p); if (G.rec) G.rec.acts.push([p, { type: "trig", id: t.id, skip: true }]); } catch (e) { console.warn(e); } }
  persist(); Arena.update(s, view()); draw(); setTimeout(drive, 50);
}
// a card played from the hand leaves it visibly, lifting toward the table where the 3D card takes over
function flyFromHand(i) {
  const el = document.querySelector(`.hcard[data-i="${i}"]`); if (!el || !window.gsap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = el.getBoundingClientRect(), c = el.cloneNode(true);
  Object.assign(c.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: "0", transform: "none", zIndex: "60", pointerEvents: "none" });
  document.body.append(c);
  window.gsap.to(c, { y: -Math.min(240, r.top * 0.45), scale: 0.72, opacity: 0, duration: 0.4, ease: "power2.in", onComplete: () => c.remove() });
}
// the React cards in hand that do not answer an attack itself: "later" are asked about by the game when their own moment
// comes in this fight (หมอมาแล้ว: an Avatar about to be destroyed, losing the fight included); "used" cannot be played
// at all because a React was already used this turn
const rk0 = (sc, d) => (sc && sc.react ? sc.react.kinds || [] : (reactTiming(d.x) || {}).kinds || []);
function heldReacts(s, p) {
  const hand = s.P[p].hand.filter((x) => { const d = E.def(s, x); return d.t === "M" && d.st === "R"; }); const nm = (l) => [...new Set(l.map((x) => E.name(s, x)))];
  const kinds = (x) => { const sc = scriptOf(s, x); return sc && sc.react ? sc.react.kinds || [] : (reactTiming(E.def(s, x).x) || {}).kinds || []; };
  if (s.mu[p].R) return { later: [], used: nm(hand.filter((x) => !E.extraMagic(s, p, x))) };
  return { later: nm(hand.filter((x) => kinds(x).some((k) => k === "doom" || k === "destroyed"))), used: [] };
}
// attacked with nothing to answer with (no awake โล่มนุษย์, no React that fits): take the attack without asking
function nothingToAnswer(s, p) { return !!s.pend && s.pend.by !== p && !s.trig.length && !s.rw && legalMoves(s, p).length <= 1 && !E.reactsFor(s, p, { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti }).length; }
function autoRespond(s, p) {
  if (!mine(p) || !nothingToAnswer(s, p) || G.castFor) return;
  const key = [s.turn, s.pend.att, s.pend.tk, s.pend.ti, s.log.length].join(":"); if (G.autoKey === key) return; G.autoKey = key;
  { const held = heldReacts(s, p); if (held.used.length) toast(`เทิร์นนี้คุณใช้ React ไปแล้ว 1 ใบ จึงใช้ ${held.used.join(", ")} ไม่ได้ (React ใช้ได้เทิร์นละ 1 ใบ)`); }
  setTimeout(() => { const n = G && G.s; if (!n || !n.pend || G.castFor || [n.turn, n.pend.att, n.pend.tk, n.pend.ti, n.log.length].join(":") !== key || !nothingToAnswer(n, p)) return; doAct((legalMoves(n, p)[0] || {}).a || { type: "respond" }, p); }, 900);
}
// bot levels: how many promising moves it plays out on a copy before choosing, how often the easy one just does something
// at random, and whether it plays its options out to its next turn before choosing (mc: play-outs per option, see
// H.mcPick). In 300 games with the same decks the pro bot beat the normal one 65%; normal beat easy 19-5 in 24.
const BOT_LEVEL = { easy: { name: "บอทมือใหม่", look: 0, rnd: 0.35, about: "บอทมือใหม่ เล่นถูกกติกาแต่ตัดสินใจไม่ค่อยดี บางทีก็มั่ว และไม่ใช้ React" },
  basic: { name: "บอท", look: 4, rnd: 0, about: "บอทระดับปกติ คิดล่วงหน้าหนึ่งจังหวะ ข้ามเอฟเฟกต์ข้อความของตัวเอง" },
  hard: { name: "บอทมือโปร", look: 4, rnd: 0, mc: 2, about: "บอทมือโปร ลองเล่นแต่ละทางเลือกล่วงหน้าจนถึงตาถัดไปของมัน (เดามือเราจากการ์ดที่ยังไม่เห็น ไม่แอบดู) แล้วเลือกทางที่ดีที่สุด และหาทางปิดเกมเมื่อเรา LIFE เหลือน้อย" } };
// bot / auto driver
async function drive() {
  if (!G || G.driving || !G.s || G.replay) return; const s = G.s;
  if (s.phase === "over") return finish();
  if (G.watch) return; // watching: nothing here acts for either side
  if (G.puzzle && s.active !== G.V) { if (!G.pzFail) { G.pzFail = true; draw(); } return; } // a puzzle is lost once the turn passes
  const p = whoActs(s); if (p == null) return;
  if (!isBot(s, p)) { if (s.trig.length && !s.rw && s.trig[0].seat === p && mine(p)) humanTrig(s, p); else if (!runQueued(s, p)) autoRespond(s, p); return; } // a React moment comes before any effect
  if (G.qAtt && !myBattle(s)) G.qAtt = null;
  // this run owns the "driving" mark until it ends: a run started from inside it (its own move leads to another bot
  // move) takes it over, and a run that finds the table changed while it waited does nothing (no stale second move)
  G.driving = true; const tok = (G.driveTok = (G.driveTok || 0) + 1), sig = stateSig(s);
  const fresh = () => !!G && G.driveTok === tok && G.s === s && stateSig(s) === sig;
  // in our own turn the bot's answers (a pass, letting an attack through, its own effects) come without a pause, so
  // attacks can follow one another quickly while the table plays the moves in order; a real answer (a React, a shield)
  // and everything in the bot's own turn wait for the table and come at the usual pace, so they can be seen
  const quick = G.brain !== "ciel" && s.phase !== "mull" && s.active !== p;
  const pace = async () => { await Arena.idle(); await sleep((G.brain === "ciel" ? 250 : 650) / animSetting()); return fresh(); };
  try {
    if (!quick && !(await pace())) return;
    let a = null; const lv = BOT_LEVEL[G.brain]; if (lv) H.look = lv.look;
    if (G.brain === "goldfish" && !s.trig.length && !(s.phase === "end" && s.need)) a = s.phase === "mull" ? { type: "mull", iids: [] } : s.rw ? { type: "pass" } : s.pend ? { type: "respond" } : { type: "end" }; // the dummy keeps its hand and never answers
    else if (s.phase === "toss") { await sleep(Math.max(0, tossBusy(s) - Date.now()) + 350); if (!fresh()) return; a = H.toss(s, p); }
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
      else m = (G.brain === "hard" && lethalMove(s, p)) || (lv && lv.mc && !s.pend && s.active === p && ["main", "battle"].includes(s.phase) ? H.mcPick(s, p, lv.mc) : H.pick(s, p));
      if (m && m.say) G.say = m.say;
      a = m ? m.a : s.pend ? { type: "respond" } : { type: "end" };
    }
    G.thinking = null; if (!fresh()) return;
    if (quick && (s.rw || (s.pend && !s.trig.length)) && !(a.type === "pass" || (a.type === "respond" && a.shield == null)) && !(await pace())) return;
    G.driving = false;
    if (!(await doAct(a, p))) { try { E.apply(G.s, { type: "end" }, p); if (G.rec) G.rec.acts.push([p, { type: "end" }]); } catch { E.lose(G.s, p, "บอทติดสถานะ"); if (G.rec) G.rec.acts.push([p, { type: "__lose", reason: "บอทติดสถานะ" }]); } Arena.update(G.s, view()); draw(); }
  } finally { if (G && G.driveTok === tok) G.driving = false; H.look = BOT_LEVEL.basic.look; }
}
// the pro bot (and Ciel) look for a win this very turn once the other side is low on LIFE, the same search the puzzles
// use, on a copy without the other side's hand (no peeking at React cards) and with its own Deck shuffled
function lethalMove(s, p) {
  if (s.pend || s.trig.length || s.rw || s.active !== p || !["main", "battle"].includes(s.phase) || s.P[1 - p].life.filter((x) => !x.up).length > 2) return null;
  const k = s.turn + ":" + p; if (G.noLethal === k) return null; // already searched this turn and found nothing
  const t = JSON.parse(JSON.stringify({ ...s, cards: null, log: [], ev: [] })); t.cards = s.cards; t.P[1 - p].hand = []; E.shuffle(t, t.P[p].deck);
  // at most 1.5 s (it runs on the page's own thread): in 365 searches over 120 games on a computer the longest that found
  // a win took 0.66 s and the median 7 ms; the two that ran past 1 s found nothing
  let r = null; try { r = solveTurn(t, p, 7, 1500); } catch { /* too big to finish */ }
  if (r && r.line && r.line.length) return { a: r.line[0].a, say: "เห็นทางชนะในเทิร์นนี้แล้ว!" };
  G.noLethal = k; return null;
}
// player's own effects: run by themselves; stop only to ask for a choice or when unreadable
const WHEN_TH = { summon: "จุติ", death: "คำสั่งเสีย", attack: "เมื่อโจมตี", attacked: "เมื่อถูกโจมตี", win: "เมื่อชนะการต่อสู้", mainStart: "ต้น Main Phase", end: "End Phase", activate: "สั่งใช้", cast: "ใช้การ์ด" };
function humanTrig(s, p) {
  const t = s.trig[0];
  if (G.tk !== t.id) { G.tk = t.id; G.tpicks = []; G.ask = null; G.askSel = []; G.tbusy = false; }
  if (G.tbusy) return;
  // Rule Book: when abilities of two or more of our cards come up together, we choose which goes first
  { const run = E.ownRun(s, p); const key = run.map((x) => x.id).sort().join(","); const same = run.every((x) => x.c === run[0].c && x.when === run[0].when); // copies of one ability: the order changes nothing
    if (run.length > 1 && !same && G.tOrd !== key && !G.tpicks.length && !(G.tOrdBatch && run.every((x) => G.tOrdBatch.includes(x.id)))) { if (!G.ask || !G.ask.order) { G.ask = { idx: -1, order: run.map((x) => x.id), key, prompt: "ความสามารถของการ์ดเราเกิดขึ้นพร้อมกัน เลือกอันที่จะให้ทำงานก่อน",
        modes: run.map((x) => `${(s.cards[x.c] || {}).n || "การ์ด"} · ${WHEN_TH[x.when] || "ความสามารถ"}`) }; draw(); } return; } }
  let r = null; try { r = resolveEffect(s, t, G.tpicks, true); } catch (e) { console.warn(e); }
  if (r && r.ask) { if (!G.ask || G.ask.idx !== r.ask.idx) { G.ask = r.ask; G.askSel = []; draw(); } return; }
  if (!(r && r.ops)) { try { r = resolveEffect(s, t); } catch (e) { console.warn(e); r = null; } } // the card's choices made the automatic way
  G.ask = null;
  if (r && r.ops) { doAct({ type: "trig", id: t.id, explain: r.explain, ops: r.ops }, p).then((ok) => { if (!ok) trigFailed(s, t, p); }); return; }
  // the rules engine could not work this one out: Ciel reads it when she is on, otherwise it is skipped (and noted, to be fixed)
  noteUnread(s, t);
  if (Ciel.on()) { G.tbusy = true; G.thinking = "ชิเอลกำลังอ่านเอฟเฟกต์ " + ((s.cards[t.c] || {}).n || ""); draw();
    cielResolve(s, t).then((c) => { if (!G || G.s !== s || G.tk !== t.id) return; G.thinking = null; doAct({ type: "trig", id: t.id, explain: c.explain || "ชิเอลอ่านเอฟเฟกต์ให้", ops: c.ops || [] }, p); })
      .catch(() => { if (!G || G.s !== s || G.tk !== t.id) return; G.thinking = null; doAct({ type: "trig", id: t.id, skip: true }, p); });
    return; }
  doAct({ type: "trig", id: t.id, skip: true }, p);
}
// effects the rules engine could not resolve by itself, kept on this device so a problem report carries them
const UNREAD = "bot.unread";
function noteUnread(s, t) {
  const d = s.cards[t.c] || {}; const c = d.im != null ? card(d.im) : null; const k = `${c ? c.p : d.n}|${t.when}${t.k != null ? "#" + t.k : ""}`;
  const m = lsGet(UNREAD, {}); m[k] = { n: d.n, when: t.when, at: Date.now(), times: ((m[k] || {}).times || 0) + 1 };
  const keys = Object.keys(m).sort((a, b) => m[b].at - m[a].at); for (const x of keys.slice(40)) delete m[x]; lsSet(UNREAD, m);
}
function finish() {
  if (!G || G.saved) { draw(); return; } G.saved = true; const s = G.s;
  if (G.puzzle) { // puzzles stay out of the history; solving enough of them opens the gold-leaf mat
    if (s.winner === G.V) { const before = earned(), qBefore = doneToday(); const d = lsGet(PZ_DONE, {}); d[G.puzzle.id] = d[G.puzzle.id] || Date.now(); lsSet(PZ_DONE, d);
      const now = earned(), fresh = ACH.filter((a) => now.has(a.id) && !before.has(a.id)), quests = dayQuests(dayOf(Date.now())).filter((x) => x.done && !qBefore.has(x.q.id)).map((x) => questNote(x.q));
      if (fresh.length || quests.length) setTimeout(() => celebrate([...quests, ...fresh]), 1800); }
    lsDel(SAVE); draw(); return; }
  const seats = G.mode === "solo" ? [] : [G.V];
  for (const V of seats) {
    const P = s.P[V], O = s.P[1 - V]; const rp = keepReplay(s.id + "-" + V);
    const th = themeCounts(deckById(P.deckId));
    const rec = { id: s.id + "-" + V, mode: G.fish ? "goldfish" : G.mode, brain: G.brain || null, lifeLost: P.life.filter((x) => x.up).length, deckId: P.deckId, th, result: s.winner === V ? "win" : s.winner == null ? "draw" : "loss", turns: s.turn, first: s.first === V, at: Date.now() };
    const fresh = newlyEarned(rec), quests = questsDoneBy(rec); // what this game unlocked, and which of today's quests it finished
    if (fresh.length || quests.length) setTimeout(() => celebrate([...quests.map(questNote), ...fresh]), 1800);
    saveMatch(s.id + "-" + V, { ...(G.gs ? { gs: G.gs } : {}), rp: rp ? 1 : 0, undo: G.undos || 0, brain: rec.brain, lifeLost: rec.lifeLost, uid: Me.uid, mode: G.fish ? "goldfish" : G.mode, deckId: P.deckId, deckName: P.deckName, th, opp: O.name, oppDeck: O.deckName, result: s.winner === V ? "win" : s.winner == null ? "draw" : "loss", turns: s.turn, reason: s.reason, first: s.first === V, at: Date.now(), log: s.log.slice(-14).map((l) => l.m) }).catch((e) => console.warn(e));
  }
  lsDel(SAVE); draw(); if (G.mode === "friend") ladderReset();
  if (G.rec && G.mode !== "friend") { const g = G; setTimeout(() => { if (G === g) openSummary(g); }, 2600); } // after the banner and the falling gold or ash
}

// an achievement earned this game: a gold notice with what it opened up
const questNote = (q) => ({ quest: true, name: q.t });
function celebrate(list) {
  for (const [k, a] of list.entries()) setTimeout(() => { const el = h("div", { class: "achpop glass", role: "status" }, h("span", { class: "eyebrow" }, a.quest ? "ภารกิจวันนี้สำเร็จ" : "ปลดล็อคความสำเร็จ"), h("b", null, a.name), a.quest ? h("span", { class: "small" }, `ได้ 1 ดาว · รวม ${stars()} ดาว`) : a.gives ? h("span", { class: "small" }, "ได้ " + rewardName(a.gives) + (a.gives.deck ? " · เปิดดูและลงสนามได้ในหน้าเด็ค" : " · เลือกใช้ในหน้าตั้งค่า")) : null);
    document.body.append(el); Sfx.play("win"); if (window.gsap) window.gsap.fromTo(el, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(2)" });
    setTimeout(() => (window.gsap ? window.gsap.to(el, { opacity: 0, duration: 0.5, onComplete: () => el.remove() }) : el.remove()), 4200); }, k * 4600);
}
// ---------- puzzles (see puzzles.js): win before the turn passes; take-backs and hints as often as wanted ----------
const PZ_DONE = "bot.pz";
let puzzleList = null;
const loadPuzzles = () => (puzzleList = puzzleList || import("../puzzles-data.js?v=20261114112449").then((m) => m.PUZZLES));
function startPuzzle(pz, k) {
  let s; try { s = puzzleState(pz); } catch (e) { return toast("เปิดโจทย์ไม่ได้: " + e.message, "bad"); }
  const V = pz.p; Object.assign(s.P[V], { uid: Me.uid, name: myName(), ava: myAvatar(), av3: myFigure(), sig: mySigil(), mat: myMat(), sleeve: mySleeve(), bot: false }); Object.assign(s.P[1 - V], { uid: null, name: "คู่แข่งในโจทย์", ava: "", av3: myFigure() ? "chang" : "", mat: botMat(), bot: true });
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
  // the toss is not worth watching move by move: the replay opens once it is decided (the table shows who goes first)
  { const R = G.replay; while (R.k < R.rec.acts.length && G.s.phase === "toss") { try { replayApply(G.s, R.rec.acts[R.k]); } catch { break; } R.k++; } }
  go();
}
const replayApply = (s, [p, a]) => {
  if (a.type === "__lose") return E.lose(s, p, a.reason);
  if (a.__fail) { try { E.apply(s, JSON.parse(JSON.stringify(a)), p); } catch { /* it broke here in the game too */ } return; }
  return E.apply(s, JSON.parse(JSON.stringify(a)), p);
};
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
      else if (e.k === "life") { if (e.by == null || e.by !== e.p) st[1 - e.p].lifeHit++; } // a LIFE flipped by its own player's card is not a hit
      else if (e.k === "destroy") st[1 - e.p].broke++;
    }
  }
  return st;
}
function openSummary(g) {
  if (!g || !g.rec) return; const s = g.s, V = g.V, st = gameStats(g.rec), me = st[V], op = st[1 - V];
  const res = s.winner === V ? "ชนะ" : s.winner == null ? "เสมอ" : "แพ้", top = (o) => Object.entries(o.played).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, k]) => `${n}${k > 1 ? " ×" + k : ""}`).join(", ");
  const row = (t, a, b) => h("div", { class: "sumrow" }, h("span", null, t), h("b", { class: "num" }, a), h("b", { class: "num" }, b));
  openSheet((api) => [h("div", { class: "statrow" }, h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ผล"), h("b", { style: `color:${res === "ชนะ" ? "#8ee3b2" : res === "แพ้" ? "#ffb0b2" : "inherit"}` }, res)),
      h("div", { class: "stat" }, h("span", { class: "eyebrow" }, "ยาว"), h("b", null, s.turn + " เทิร์น"))),
    s.reason ? h("div", { class: "small muted" }, s.reason) : null,
    g.fish && s.winner === V ? h("div", { class: "small" }, h("b", null, "ซ้อมมือเดียว: "), `ชนะในเทิร์นที่ ${s.turn} ของเกม คือตาที่ ${s.first === V ? Math.ceil(s.turn / 2) : Math.floor(s.turn / 2)} ของเรา`, g.undos ? ` · ย้อนตา ${g.undos} ครั้ง` : "") : null,
    h("div", { class: "sumtab" }, h("div", { class: "sumrow head tiny muted" }, h("span"), h("span", null, s.P[V].name), h("span", null, s.P[1 - V].name)),
      row("อัญเชิญ Avatar", me.summon, op.summon), row("ใช้ Magic", me.cast, op.cast), row("ประกาศโจมตี", me.attack, op.attack), row("ทำลายการ์ดคู่แข่ง", me.broke, op.broke), row("ทำ LIFE คู่แข่งหงาย", me.lifeHit, op.lifeHit)),
    top(me) ? h("div", { class: "small" }, h("b", null, "ลงบ่อยของเรา: "), top(me)) : null, top(op) ? h("div", { class: "small muted" }, h("b", null, "ของคู่แข่ง: "), top(op)) : null, // (a side that played nothing has no line)
    h("div", { class: "row" }, g.mode !== "replay" ? h("button", { class: "btn gold", onclick: () => { api.close(); if (G === g) rematch(); } }, "ดวลอีกครั้ง") : null,
      hasReplay(s.id + "-" + V) ? h("button", { class: "btn", onclick: () => { api.close(); openReplay(s.id + "-" + V); } }, "ดูรีเพลย์") : null,
      h("button", { class: "btn", onclick: () => api.close() }, "ดูกระดาน"))], { title: "สรุปเกม", sub: g.fish ? `${s.P[V].deckName} · ซ้อมมือเดียว` : `${s.P[V].deckName} vs ${s.P[1 - V].deckName}` });
}
// ---------- field interaction ----------
function fieldClick(i) {
  if (!G || !G.s) return; const s = G.s; const p = whoActs(s);
  if (i == null) return closePicked(); // the empty table
  if (i === "life") { if (G.att != null && myBattle(s)) aimAt(G.att, "life"); return; }
  // the side zones of a wide table: a pile opens what is in it, a LIFE card face down opens that player's LIFE, one face up is read
  if (typeof i === "string") { const [k, a, b] = i.split(":"); if (k === "pile" && s.P[+a]) openPile(s.P[+a], b); else if (k === "lifes") { const Lf = E.locate(s, +a); if (Lf) openLife(s.P[Lf.p]); } return; }
  const L = E.locate(s, i); if (!L) return;
  if (askOnTable(s) && G.ask.options.includes(i)) return askToggle(i); // an effect is asking for one of these cards: the tap picks it
  if (L.z === "life") { if (L.x.up) cardView(L.x); else openLife(s.P[L.p]); return; }
  if (!G.host && myBattle(s)) {
    // aiming: a card of the other side is the target. Picking it attacks and opens nothing over the table (a card is
    // read by pointing at it or with a right-click, as in other digital card games)
    if (G.att != null && L.p !== s.active && (L.z === "av" || L.z === "cs")) return aimAt(G.att, L.z, i);
    // an awake Avatar of ours starts an attack, also while the last attack is still being answered. On a phone the
    // same card tapped again opens it (its abilities), instead of the card opening on the first tap
    // (a card with an ability usable now opens on the first tap, so the ability is never hidden behind a second one)
    const hasUse = () => abilityActs(s, L.x, L, true).some((a) => a[1] && !/^โจมตี/.test(a[0]));
    if (L.p === s.active && L.z === "av" && L.x.a && !(touchy() && (G.att === i || hasUse()))) { G.att = i; G.sel = touchy() ? null : i; Arena.select(i); draw(); return; }
  }
  G.sel = i; Arena.select(i); drawInspector();
  const choosingTarget = G.host ? L.z === "av" : G.att && L.p !== p && (L.z === "av" || L.z === "cs");
  if (touchy() && !choosingTarget) { G.att = null; return cardView(L.x); }
  if (G.host) { if (L.z === "av") { const host = G.host; G.host = null; doAct({ type: "cast", i: host, on: i }, view()); } return; }
}
// a pick among cards on the table: when two options carry the same name, each button says which copy it is ("#1", "#2", counted
// in table order) and pointing at or choosing a button lights that very card up on the table
function copyTag(s, i, all) { const L = E.locate(s, i); if (!L || (L.z !== "av" && L.z !== "cs")) return ""; const nm = E.name(s, L.x);
  const same = all.map((j) => E.locate(s, j)).filter((M) => M && M.z === L.z && M.p === L.p && E.name(s, M.x) === nm); if (same.length < 2) return "";
  return "#" + (s.P[L.p][L.z].filter((y) => E.name(s, y) === nm).indexOf(L.x) + 1) + " "; }
// an effect's pick: choose or un-choose option i (from its button or by tapping the card on the table)
function askToggle(i) { const a = G.ask; if (!a || !Array.isArray(a.options) || !a.options.includes(i)) return; const sel = G.askSel || []; const need = Math.min(a.n, a.options.length);
  G.askSel = sel.includes(i) ? sel.filter((y) => y !== i) : need === 1 ? [i] : sel.length < need ? [...sel, i] : sel; const L = E.locate(G.s, i); if (L && (L.z === "av" || L.z === "cs")) Arena.select(G.askSel.includes(i) ? i : null); draw(); }
const askOnTable = (s) => { const a = G && G.ask; if (!a || a.order || a.modes || !Array.isArray(a.options) || !s.trig.length || G.tk !== s.trig[0].id) return null; const show = Array.isArray(a.reveal) ? a.reveal : a.options; return show.length && show.every((i) => { const L = E.locate(s, i); return L && (L.z === "av" || L.z === "cs"); }) ? a : null; };
function pointAt(btn, i) { if (!btn) return btn; const on = () => { const L = E.locate(G.s, i); if (L && (L.z === "av" || L.z === "cs")) Arena.select(i); }; btn.addEventListener("mouseenter", on); btn.addEventListener("focus", on); return btn; }
// the attack being answered: who hits whom with what POWER, and who would be destroyed if nothing is played
function fightForecast(s) { const pd = s.pend; if (!pd) return null; const A = E.locate(s, pd.att); if (!A) return null; if (pd.tk === "life") return { A, T: null, ap: Math.max(0, E.power(s, A.x) + (pd.bonus || 0)), tp: 0, dead: "" };
  const T = E.locate(s, pd.ti); if (!T) return null; const av = pd.tk === "av";
  const ap = Math.max(0, E.power(s, A.x) + (pd.bonus || 0) + (av ? E.battleMod(s, A.x, T.x) : 0)), tp = Math.max(0, E.power(s, T.x) + (av ? E.battleMod(s, T.x, A.x) : 0));
  let dead = ""; if (!av) dead = ap > tp ? "T" : ""; else if (ap > tp) dead = "T"; else if (tp > ap) dead = "A"; else if (ap > 0) { const ah = E.kw(s, A.x, "ลูกฮึด"), dh = E.kw(s, T.x, "ลูกฮึด"); dead = ah && !dh ? "T" : dh && !ah ? "A" : "AT"; }
  return { A, T, ap, tp, dead }; }
// a card on the table by name, with "#2" when the same side has another of that name in the zone
const tagName = (s, L) => { if (!L) return "?"; const all = (s.P[L.p][L.z] || []).map((y) => y.i); const tg = L.z === "av" || L.z === "cs" ? copyTag(s, L.x.i, all).trim() : ""; return E.name(s, L.x) + (tg ? " " + tg : ""); };
// an arrow on the table from the attacker to what it attacks while the attack is being answered (also through the
// "about to be destroyed" question), so the target is seen and not only read
function foeArrow() {
  let svg = document.getElementById("foearrow"); const s = G && G.s; const pd = s && s.pend;
  const from = pd && Arena.on && !G.replay ? Arena.screenOf(pd.att) : null; const def = pd ? 1 - pd.by : 0;
  const lifeCard = pd && pd.tk === "life" ? (s.P[def].life.find((l) => !l.up) || s.P[def].life[0]) : null;
  const to = !from ? null : pd.tk === "life" ? (lifeCard ? Arena.screenOf(lifeCard.i) : null) : Arena.screenOf(pd.ti);
  if (!from || !to) { if (svg) svg.remove(); return; }
  if (!svg) { svg = document.createElementNS(SVGNS, "svg"); svg.id = "foearrow"; svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<defs><marker id="foehead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ff4a4a"/></marker></defs><path class="glow"/><path class="shaft" marker-end="url(#foehead)"/><circle class="ret" r="26"/>'; document.body.append(svg); }
  const sx = from.x, sy = from.y, ex = to.x, ey = to.y, dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy); if (len < 24) { svg.style.display = "none"; return; } svg.style.display = "";
  const cx = (sx + ex) / 2 - dy * 0.12, cy = (sy + ey) / 2 - Math.min(90, len * 0.2); const d = `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
  svg.querySelector(".shaft").setAttribute("d", d); svg.querySelector(".glow").setAttribute("d", d);
  const ret = svg.querySelector(".ret"); ret.setAttribute("cx", ex); ret.setAttribute("cy", ey); ret.setAttribute("r", Math.max(18, Math.min(to.w, to.h) * 0.5));
}
// the Battle Phase of a side played on this screen (the other side may still be answering an attack)
const myBattle = (s) => !!G && !G.replay && !G.watch && s.phase === "battle" && mine(s.active);
// this side may attack right now: nothing is being answered or resolved
const freeToAttack = (s) => myBattle(s) && whoActs(s) === s.active && !s.pend && !s.trig.length && !s.rw && !G.lock;
// an attack picked by the player goes now when it can, otherwise as soon as the attack being answered is over, so
// attacks can be clicked one after another without waiting for each fight to finish
function aimAt(att, tk, ti) {
  const s = G.s; G.sel = null; G.att = null; G.muteHover = ti; Arena.select(null);
  if (freeToAttack(s)) return attack(att, tk, ti);
  G.qAtt = (G.qAtt || []).filter((q) => q.att !== att).concat([{ att, tk, ti }]);
  toast(G.qAtt.length > 1 ? `สั่งโจมตีต่อไว้ ${G.qAtt.length} ครั้ง` : "สั่งโจมตีต่อไว้แล้ว จะตีทันทีที่การต่อสู้นี้จบ"); draw();
}
// the attacks clicked while a fight was going on, one after another, each only if it is still allowed then
function runQueued(s, p) {
  if (!G.qAtt || !G.qAtt.length) return false;
  if (!myBattle(s) || p !== s.active) { G.qAtt = null; return false; } // the turn or the phase moved on
  if (!freeToAttack(s)) return false;
  const ms = legalMoves(s, p).filter((m) => m.a.type === "attack");
  while (G.qAtt.length) {
    const q = G.qAtt.shift();
    if (ms.some((m) => m.a.i === q.att && m.a.tk === q.tk && (q.ti == null || m.a.ti === q.ti))) { setTimeout(() => { if (G && G.s === s && freeToAttack(s)) attack(q.att, q.tk, q.ti); }, 0); return true; }
    toast("การโจมตีที่สั่งไว้ทำไม่ได้แล้ว (เป้าหรือผู้โจมตีเปลี่ยนไป)", "bad");
  }
  return false;
}
// drag to attack: press an awake Avatar of ours, drag, let go on a card of the other side or on the LIFE marker
function onDrag(kind, from, e, to) {
  if (!G || !G.s) return; const s = G.s;
  if (kind === "start") { const L = from != null && from !== "life" && E.locate(s, from); G.dragFrom = L && !G.host && myBattle(s) && L.p === s.active && L.z === "av" && L.x.a ? from : null; return; }
  if (G.dragFrom == null) return;
  if (kind === "cancel") { G.dragFrom = null; attackArrow(); return; }
  if (kind === "move") { if (G.att !== G.dragFrom) { G.att = G.dragFrom; G.sel = null; Arena.select(G.att); draw(); } if (e) { ptr = { x: e.clientX, y: e.clientY }; attackArrow(); } return; }
  if (kind === "drop") { const f = G.dragFrom; G.dragFrom = null; G.att = f; if (to != null && to !== f) fieldClick(to); else draw(); attackArrow(); }
}
function attack(att, tk, ti) {
  const s = G.s, p = s.active, P = s.P[p];
  const ax = P.av.find((y) => y.i === att); const helpers = ax ? E.helpPool(s, p).filter((y) => E.helpOf(s, p, ax, y)) : [];
  if (!helpers.length) return doAct({ type: "attack", i: att, tk, ti }, p);
  G.helperPick = { att, tk, ti, sup: [] }; draw();
}

// ---------- HUD ----------
// a picture of the table to keep or share: the 3D table as it is now (the hand is not in it), with a strip naming the game
async function snapTable() {
  if (!G || !G.s) return; const c = Arena.on ? Arena.snapshot() : null;
  if (!c) return toast("แคปไม่ได้ในโหมดภาพแบบเรียบ ใช้ปุ่มแคปหน้าจอของเครื่องแทนได้เลย", "bad");
  const s = G.s, V = G.V, me = s.P[V], op = s.P[1 - V], g = c.getContext("2d"), H = Math.max(34, Math.round(c.height * 0.055)), W = c.width;
  const gr = g.createLinearGradient(0, c.height - H * 1.6, 0, c.height); gr.addColorStop(0, "rgba(14,8,7,0)"); gr.addColorStop(1, "rgba(14,8,7,.9)"); g.fillStyle = gr; g.fillRect(0, c.height - H * 1.6, W, H * 1.6);
  g.textBaseline = "middle"; g.fillStyle = "#e9c46a"; g.font = `700 ${Math.round(H * 0.42)}px "Chakra Petch", "IBM Plex Sans Thai", sans-serif`; g.textAlign = "left";
  g.fillText(`BoT Arena · ${me.name} vs ${op.name} · เทิร์น ${s.turn}`, H * 0.5, c.height - H * 0.55);
  g.textAlign = "right"; g.fillStyle = "rgba(255,240,220,.8)"; g.font = `500 ${Math.round(H * 0.34)}px "IBM Plex Sans Thai", sans-serif`; g.fillText(new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }), W - H * 0.5, c.height - H * 0.55);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9)); if (!blob) return toast("แคปไม่สำเร็จ", "bad");
  const name = `bot-arena-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.jpg`, url = URL.createObjectURL(blob), file = new File([blob], name, { type: "image/jpeg" });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  openSheet((api) => [h("img", { src: url, alt: "ภาพโต๊ะตอนนี้", style: "width:100%;border-radius:10px;border:1px solid var(--line)" }),
    h("div", { class: "row wrap" }, h("a", { class: "btn gold", href: url, download: name }, "บันทึกรูป"),
      canShare ? h("button", { class: "btn", onclick: () => navigator.share({ files: [file], title: "BoT Arena" }).catch(() => {}) }, "แชร์") : null,
      h("button", { class: "btn", onclick: () => api.close() }, "ปิด"))], { title: "ภาพโต๊ะ", sub: "ไม่ติดไพ่บนมือของเรา", wide: true, onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000) });
}
const ICON = { flip: "M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7", coach: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2z", tools: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4", hell: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4",
  ask: "M4 6h16v12H4zM4 7l8 6 8-6", emote: "M4 5h16v10H10l-4 4v-4H4zM9 10h.01M12 10h.01M15 10h.01", sound: "M5 10v4h3l4 3V7L8 10zM16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11", mute: "M5 10v4h3l4 3V7L8 10zM16 10l4 4M20 10l-4 4", snap: "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" };
const idleBar = () => (G && G.idleShown && oppIdle() > IDLE_MS ? h("div", { class: "idlebar glass", role: "status" }, h("span", null, `${G.s.P[1 - G.V].name} ไม่ได้เล่นมา ${Math.floor(oppIdle() / 60e3)} นาที`),
  h("button", { class: "btn sm gold", onclick: () => confirmBox("ขอชนะเกมนี้เพราะคู่แข่งไม่อยู่?", "ขอชนะ", claimIdle) }, "ขอชนะเกมนี้")) : null);
function tool(icon, label, short, fn, off) {
  const ic = h("span", { class: "ic" }); ic.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[icon]}"/></svg>`;
  return h("button", { class: "tool", type: "button", title: label, "aria-label": label, disabled: !!off, onclick: fn }, ic, h("span", null, short));
}
// why a card on the table has the POWER it has, when something changes it: "POWER 0 = ตั้งต้น 1 · ขวัญตา … −4 (ไม่ต่ำกว่า 0)"
function powerNote(s, x, L) {
  if (!L || (L.z !== "av" && L.z !== "cs")) return null; const { total, parts, halved } = E.powerParts(s, x); if (parts.length < 2 && !halved && !x.zero) return null;
  const sum = parts.reduce((a, [, n]) => a + n, 0), sg = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + -n : "0");
  return `POWER ${total} = ${parts.map(([t, n], k) => (k ? `${t} ${sg(n)}` : `${t} ${n}`)).join(" · ")}${sum < 0 && total === 0 && !halved ? " (ไม่ต่ำกว่า 0)" : ""}`;
}
// close the card that is open (its buttons) and drop a half-made attack: a click on the empty table, Esc, or ✕
function closePicked() { if (!G) return; const had = G.sel != null || G.att != null; G.sel = null; G.att = null; Arena.select(null); if (had) draw(); else drawInspector(); }
// leave the table: a game still running is kept to carry on later, so it only asks first
function leaveArena() { const s = G && G.s; if (!s) return; if (s.phase === "over" || G.watch || G.replay) exitGame(); else confirmBox("ออกจากสนาม? เกมที่ค้างจะเก็บไว้ให้เล่นต่อ", "ออก", exitGame); }
function crystals(P, opp, prevKey) {
  const prev = G[prevKey] ?? P.life.filter((x) => x.up).length; const now = P.life.filter((x) => x.up).length; G[prevKey] = now; const crit = E.critical(P);
  // a tap shows the LIFE cards (การ์ดบ้าน) that are face up: their abilities are public once turned
  const open = () => openLife(P);
  return h("div", { class: "crys tap", role: "button", tabindex: "0", title: "ดู LIFE ที่หงายแล้ว", "aria-label": `LIFE เหลือ ${5 - now} จาก 5 · ดู LIFE ที่หงายแล้ว`, onclick: open, onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } } },
    [0, 1, 2, 3, 4].map((k) => h("i", { class: "cry" + (opp ? " opp" : "") + (k < now ? " gone" : "") + (k < now && k >= prev ? " now" : "") + (crit ? " crit" : "") })));
}
function openLife(P) {
  const s = G && G.s; if (!s) return; const up = P.life.filter((x) => x.up);
  openSheet((api) => [h("div", { class: "small muted" }, `หงายแล้ว ${up.length} ใบ · คว่ำอยู่ ${P.life.length - up.length} ใบ${E.critical(P) ? " · สถานะสาหัส (LIFE หงายหมด)" : ""}`),
    up.length ? h("div", { class: "pick" }, up.map((x) => cardBtn(E.def(s, x).im, { seat: x.o, onclick: () => { api.close(); cardView(x); } }))) : h("div", { class: "empty" }, "ยังไม่มี LIFE ที่หงาย")],
  { title: `LIFE (การ์ดบ้าน) · ${P.name}`, sub: "แตะการ์ดเพื่ออ่านความสามารถ" });
}
function draw() {
  if (!G || !G.hud || !G.s) return; setGameSkins(G.s.P, Me.uid); if (!G.replay) sayLog(G.s); if (G.hoverHand != null && !G.s.P[view()].hand.some((x) => x.i === G.hoverHand)) G.hoverHand = null; const s = G.s; const V = view(); const me = s.P[V], op = s.P[1 - V]; const p = whoActs(s);
  const myTurn = p != null && mine(p);
  document.body.classList.toggle("tossing", s.phase === "toss"); // the hand stays face down until it is settled who starts
  if (s.toss && s.toss.pick && G.tossSaid !== s.id) { G.tossSaid = s.id; if (s.turn === 0) toast(`${s.P[s.first].name} เริ่มก่อน`); }
  const hint0 = G.replay ? `รีเพลย์ · เทิร์น ${s.turn} · ${s.phase === "over" ? "จบเกม" : "ตาของ " + s.P[s.active].name}`
    : G.puzzle && (G.pzFail || s.phase === "over") ? (s.phase === "over" && s.winner === V ? `ไขโจทย์ที่ ${G.puzzle.k + 1} สำเร็จ!` : "หมดเทิร์นแล้วยังไม่ชนะ · ย้อนตาหรือเริ่มโจทย์ใหม่")
    : G.watch ? (s.phase === "over" ? (s.winner == null ? "เสมอ · " : s.P[s.winner].name + " ชนะ · ") + s.reason : "กำลังชม" + (p == null ? "" : ` · รอ ${s.P[p].name}…`)) : s.phase === "over" ? (s.winner === V ? "ชนะ! " : s.winner == null ? "เสมอ · " : "แพ้ · ") + s.reason
    : G.thinking || (p == null ? "" : s.phase === "toss" ? "เสี่ยงทายว่าใครได้เลือกเริ่มก่อนหรือทีหลัง" : !mine(p) ? `รอ ${s.P[p].name}…` : s.phase === "mull" ? "เลือกการ์ดที่จะเปลี่ยน หรือเก็บมือเดิม" : s.trig.length ? "มีเอฟเฟกต์ต้องจัดการ" : s.rw ? "ใช้ React ตอบโต้ หรือกด ไม่ตอบโต้" : s.pend ? "ถูกโจมตี เลือกการตอบโต้" : s.phase === "main" ? "Main Phase · แตะการ์ดบนมือเพื่อเล่น" : s.phase === "battle" ? (G.att != null ? (touchy() ? "แตะเป้าหมาย · แตะใบเดิมอีกครั้งเพื่อดูการ์ด" : "คลิกเป้าหมาย หรือลากไปปล่อยที่เป้า") : "Battle · ลาก Avatar ที่ตื่นไปที่เป้าหมาย หรือแตะทีละใบ") : s.phase === "end" && s.need ? `ทิ้งการ์ด ${s.need} ใบ` : "");
  const hint = G.puzzle && !G.pzFail && s.phase !== "over" && hint0 ? `โจทย์ที่ ${G.puzzle.k + 1} · ` + hint0 : hint0;
  const pile = (P, z, t) => h("button", { onclick: () => openPile(P, z) }, h("b", null, P[z].length), h("span", null, t));
  const ph = ["draw", "main", "battle", "end"];
  if (compact()) {
    // phones: leaving is always one tap away (top left), and once the game is over it sits next to "ดวลอีกครั้ง"
    const leave = h("button", { class: "btn sm exitm", type: "button", title: "ออกจากสนาม", "aria-label": "ออกจากสนาม", onclick: leaveArena }, "←");
    const bar = s.phase === "over" && !G.replay ? [turnButtons(s, p).filter(Boolean)[0], h("button", { class: "btn sm", onclick: leaveArena }, "ออก")].filter(Boolean) : turnButtons(s, p).filter(Boolean).slice(0, 2);
    const SHORT = { "ไป Battle Phase": "ไป Battle", "จบเทิร์นเลย": "จบเทิร์น", "ยกเลิกการเลือก": "ยกเลิก" }; // the phone bar has room for two short labels
    for (const b of bar) { const t = b.textContent.trim(); if (SHORT[t]) { b.title = t; b.setAttribute("aria-label", t); b.textContent = SHORT[t]; } }
    G.hud.replaceChildren(
      h("div", { class: "oppbar glass" }, leave, op.bot && !op.ava ? h("span", { class: "ava sm" }, "✦") : avatarEl(op.ava, op.name, "sm"), h("div", { class: "pname" }, h("b", null, op.name), h("span", null, `มือ ${op.hand.length} · Deck ${op.deck.length}`)), crystals(op, true, "pcOp")),
      hint ? h("div", { class: "hint" }, G.say && !mine(p ?? -1) ? "✦ " + G.say : hint) : null,
      G.watch ? watchHand(me) : handZone(s, V, p), promptBox(s, p), tutorBox(s, V, p), idleBar(),
      h("div", { class: "mbar glass" },
        h("button", { class: "btn sm" + (farActs(s, p).length ? " hasacts" : ""), "aria-label": farActs(s, p).length ? "เมนูเกม (มีความสามารถที่สั่งใช้ได้)" : "เมนูเกม", onclick: () => gameMenu(s, V) }, "☰"),
        h("div", { class: "mstat" }, h("div", { class: "mturn" }, h("b", null, `เทิร์น ${s.turn}`), h("span", null, s.phase === "mull" ? "เปลี่ยนมือ" : PHASE_TH[s.phase])), crystals(me, false, "pcMe")),
        h("div", { class: "grow" }), ...bar));
    afterDraw(s, V, op, myTurn); return;
  }
  G.hud.replaceChildren(
    h("div", { class: "oppbar glass" }, op.bot && !op.ava ? h("span", { class: "ava" }, "✦") : avatarEl(op.ava, op.name), h("div", { class: "pname" }, h("b", null, op.name), h("span", null, `${op.deckName} · Deck ${op.deck.length}`)), crystals(op, true, "pcOp"),
      h("div", { class: "backs", role: "img", "aria-label": `มือ ${op.hand.length} ใบ` }, op.hand.slice(0, 10).map(() => h("i"))), G.say ? h("span", { class: "chip gold", style: "max-width:220px;overflow:hidden;text-overflow:ellipsis" }, "✦ " + G.say) : null),
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
      h("div", { class: "rail hidem" }, G.watch ? tool("flip", "สลับไปดูจากอีกฝั่ง", "สลับฝั่ง", flipWatch) : tool("coach", "ชิเอลแนะนำ", "แนะนำ", coach, s.phase === "over"), G.watch ? null : tool("tools", "เมนูเกม: กองการ์ด ย้อนตา แจ้งปัญหา ยอมแพ้", "เมนู", () => gameMenu(s, V)), tool("hell", G.watch ? "ดูนรกของ " + op.name : "ดูนรกของคู่แข่ง", G.watch ? "นรกอีกฝั่ง" : "นรกคู่แข่ง", () => openPile(op, "hell")),
        isOwner() && !G.watch ? tool("ask", "ถามชิเอลเกี่ยวกับตานี้", "ถามชิเอล", () => openAsk()) : null, tool(Sfx.on || Music.on ? "sound" : "mute", "เสียงเอฟเฟกต์และเพลง", "เสียง", soundSheet), tool("snap", "แคปภาพโต๊ะ (ไม่ติดไพ่บนมือ)", "แคป", snapTable)),
      G.coach ? h("div", { class: "coachbox" }, G.coach) : null,
      h("div", { class: "feed", tabindex: "0", "aria-label": "บันทึกเกม" }, s.log.slice(-30).reverse().map((l) => h("div", { class: l.s === V ? "mine" : l.s === 1 - V ? "opp" : "" }, l.m)))),
    G.watch ? watchHand(me) : handZone(s, V, p), promptBox(s, p), tutorBox(s, V, p), idleBar(),
    h("button", { class: "btn sm arena-exit", onclick: leaveArena }, "← ออก"));
  afterDraw(s, V, op, myTurn);
}
// ---------- learn mode: each part of the game explained the first time it comes up ----------
const mainMine = (s, V, p) => s.phase === "main" && s.active === V && p === V && !s.trig.length && !s.rw && !s.pend;
const canDo = (s, V, type) => legalMoves(s, V).some((m) => m.a.type === type);
const recentFight = (s) => s.log.slice(-12).some((l) => /แพ้การต่อสู้|พลังเท่ากัน/.test(l.m));
const LESSONS = [
  { k: "start", when: (s) => s.phase === "mull", t: "ยินดีต้อนรับสู่สนามดวล",
    b: () => ["ฝั่งล่างเป็นของคุณ ฝั่งบนเป็นของบอท ทุกคนเริ่มด้วยการ์ดบนมือ 5 ใบ และ LIFE (การ์ดบ้าน) 5 ใบที่คว่ำไว้", "ตอนนี้เปลี่ยนมือได้ครั้งเดียว แตะการ์ดที่ไม่อยากเก็บแล้วกดเปลี่ยน หรือกด เก็บมือเดิม"] },
  { k: "turn", when: mainMine, t: "ลำดับในหนึ่งเทิร์น",
    b: () => ["Draw → Main → Battle → End ดูเฟสปัจจุบันได้ที่แถบด้านขวา", "ต้นเทิร์นจั่ว 1 ใบ ถ้ามือเหลือไม่ถึง 3 ใบจะจั่วจนครบ 3", "ผู้ที่เริ่มก่อนจั่ว 2 ใบในเทิร์นแรก แต่ไม่มี Battle Phase ในเทิร์นนั้น", "การ์ดใน Deck หมดเมื่อไรแพ้ทันที"] },
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
    b: () => ["แตะ Avatar ของเราที่ตื่นอยู่ แล้วเลือกเป้าหมาย", "โจมตี LIFE (ตีบ้าน) ได้เมื่ออีกฝ่ายไม่มี Avatar หรือการ์ดของเรามีความสามารถ เตะไข่", "ไม่มีอะไรจะทำแล้วกด จบเทิร์น"] },
  { k: "fight", when: (s) => recentFight(s), t: "ผลการต่อสู้",
    b: () => ["เทียบ POWER ฝ่ายที่น้อยกว่าถูกทำลายลงนรก", "POWER เท่ากันถูกทำลายทั้งคู่ ยกเว้นฝ่ายที่มีความสามารถ ลูกฮึด"] },
  { k: "defend", when: (s, V) => !!s.pend && s.pend.by !== V, t: "ถูกโจมตี",
    b: () => ["เลือกได้ว่าจะปล่อยให้โจมตี ให้ Avatar ที่มี โล่มนุษย์ รับแทน หรือใช้ React", "ถ้าไม่มีอะไรตอบโต้ได้ เกมจะไปต่อเอง"] },
  { k: "react", when: (s, V) => !!s.rw && s.rw.by !== V && E.reactsFor(s, V, s.rw).length > 0, t: "จังหวะตอบโต้",
    b: () => ["อีกฝ่ายเพิ่งทำบางอย่าง และคุณมี React ที่ใช้ตอบได้", "กดใช้การ์ด หรือ ไม่ตอบโต้ เพื่อปล่อยผ่าน"] },
  { k: "life", when: (s) => s.P.some((P) => P.life.some((y) => y.up)), t: "LIFE Card (การ์ดบ้าน)",
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
    row("เพลงประกอบ", "แต่งสดตามจังหวะเกม ไม่ซ้ำเดิม", Music.on, (v) => { if (v !== Music.on) Music.toggle(); }, Music.vol, (v) => Music.setVolume(v)),
    h("div", { class: "row" }, h("span", { class: "small muted" }, "แนวเพลงในสนาม"), h("div", { class: "seg", role: "group", "aria-label": "แนวเพลงในสนาม" }, Object.entries(MUSIC_STYLES).map(([k, t]) => h("button", { "aria-pressed": Music.style === k ? "true" : "false", onclick: (e) => { Music.setStyle(k); for (const b of e.currentTarget.parentElement.children) b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false"); } }, t)))),
    h("div", { class: "sndrow" }, h("label", { class: "chk" }, h("input", { type: "checkbox", checked: Music.menu, onchange: (e) => Music.setMenu(e.target.checked) }), h("b", null, "เพลงหน้าเมนู")), h("span", { class: "tiny muted" }, "เพลงเบาๆ ตอนเลือกเด็คและดูการ์ด"))], { title: "เสียง", onClose: () => draw() });
}
// the music follows the game: our turn or theirs, a fight, someone one LIFE from losing, the end
function musicMood(s, V) {
  if (s.phase === "over") return s.winner === V ? "win" : "lose";
  const crit = E.critical(s.P[V]) || E.critical(s.P[1 - V]), fight = s.phase === "battle" || !!s.pend;
  return crit ? (fight ? "climax" : "tense") : fight ? "battle" : s.phase === "mull" || s.active === V ? "mine" : "foe";
}
// how tense the game is, 0 to 1: late turns, and LIFE turned up on either side (the score adds a layer for it)
function tension(s) {
  const life = Math.max(...[0, 1].map((p) => { const L = s.P[p].life; return L.length ? L.filter((x) => x.up).length / L.length : 0; }));
  return Math.max(0, Math.min(1, Math.max((s.turn - 8) / 12, (life - 0.35) / 0.6)));
}
function afterDraw(s, V, op, myTurn) {
  const me = s.P[V]; Music.mood(musicMood(s, V)); Music.level(tension(s)); if (G.replay) G.hud.append(replayBar());
  drawInspector();
  const targets = [];
  if (G.att) { targets.push(...op.av.map((x) => x.i), ...op.cs.map((x) => x.i)); }
  else if (myTurn && s.phase === "battle" && !s.pend && !s.trig.length) targets.push(...me.av.filter((x) => x.a).map((x) => x.i));
  if (!G.att && !G.host && myTurn && s.active === V && ["main", "battle"].includes(s.phase) && !s.pend && !s.trig.length && !s.rw && !G.replay)
    for (const m of legalMoves(s, V)) if (m.a.type === "activate") { const L = E.locate(s, m.a.i); if (L && ["av", "cs", "mg", "land"].includes(L.z)) targets.push(m.a.i); }
  if (G.host) targets.push(...s.P[0].av.map((x) => x.i), ...s.P[1].av.map((x) => x.i));
  if (askOnTable(s)) { targets.length = 0; targets.push(...G.ask.options); }
  if (s.rw && s.rw.kind === "doom" && mine(s.rw.p) && (s.rw.ids || []).length) { targets.length = 0; targets.push(...s.rw.ids); } // the card about to be destroyed glows
  Arena.highlight(targets); const AL = G.att && E.locate(s, G.att); const lifeOk = !!AL && (E.lifeOpen(s, AL.p, AL.x) || E.kw(s, AL.x, "เตะไข่")) && !E.noLife(s, AL.x); Arena.setLifeTarget(lifeOk);
  if (G.flat) drawFlat(s, V, new Set(targets), lifeOk);
  attackArrow(); foeArrow(); Arena.idle().then(() => foeArrow()); setTimeout(foeArrow, 450);
}
// no 3D (WebGL off or missing on this device): the table drawn flat, each side's zones as rows of cards, pressed the way
// the 3D cards are (choose an attacker, its target, an ability), right-click or the card view to read one
function drawFlat(s, V, lit, lifeOk) {
  const me = s.P[V], op = s.P[1 - V], small = compact();
  const fcard = (x, z) => {
    const d = E.def(s, x), c = d.im != null ? card(d.im) : null, fights = z === "av" || z === "cs", host = x.on != null && E.locate(s, x.on);
    const b = h("button", { class: "fcard" + (z === "av" && !x.a ? " asleep" : "") + (z === "av" && x.a && myBattle(s) && (E.locate(s, x.i) || {}).p === s.active ? " drag" : "") + (G.att === x.i || G.sel === x.i ? " sel" : "") + (lit.has(x.i) ? " can" : ""), "data-i": x.i, "data-name": d.n,
      title: host ? `${d.n} · ติดอยู่กับ ${E.name(s, host.x)}` : d.n, "aria-label": `${d.n}${fights ? ` POWER ${E.power(s, x)}` : ""}${z === "av" && !x.a ? " (นอน)" : ""}`, onclick: () => fieldClick(x.i) },
      c ? artImg(c, undefined, undefined, x.o) : h("span", { class: "fname" }, d.n), fights ? h("span", { class: "fpow num" }, E.power(s, x)) : null, z === "av" && !x.a ? h("span", { class: "fnap" }, "นอน") : null);
    b.addEventListener("contextmenu", (e) => { e.preventDefault(); cardView(x); });
    b.addEventListener("mouseenter", () => { G.hover = x.i; drawInspector(); });
    b.addEventListener("mouseleave", () => { if (G.hover === x.i) { G.hover = null; drawInspector(); } });
    return b;
  };
  const zone = (label, list, z) => h("div", { class: "fzone fz-" + z }, h("span", { class: "fzl" }, label), ...list.map((x) => fcard(x, z)));
  // each side: its Avatar Zone, and a row of Construct, Magic and Land Magic (on a phone only the ones with cards in them)
  const side = (P, seat, top) => {
    const more = [["Construct", P.cs, "cs"], ["Magic", P.mg, "mg"], ["Land Magic", [s.land, s.land2].filter((y) => y && y.o === seat), "land"]].filter(([, l]) => !small || l.length);
    const rows = [h("div", { class: "frow" }, zone("Avatar Zone", P.av, "av")), more.length ? h("div", { class: "frow" }, ...more.map(([t, l, z]) => zone(t, l, z))) : null].filter(Boolean);
    return { n: rows.length, el: h("div", { class: "fside " + (top ? "fopp" : "fme"), "aria-label": top ? `สนามของ ${P.name}` : "สนามของเรา" }, ...(top ? rows.reverse() : rows)) };
  };
  const A = side(op, 1 - V, true), B = side(me, V, false), n = A.n + B.n, gap = small ? 6 : 8;
  // the band between the bars on top and the hand below (on a computer also room for the one-row prompt), with the cards
  // sized so every row fits in it
  const bot = (q) => { const el = document.querySelector(q); return el ? el.getBoundingClientRect().bottom : 0; };
  const hand = document.querySelector(".hud .handrow") || document.querySelector(".hud .handzone");
  const top = Math.max(bot(".hud .oppbar"), bot(".hud .hint")) + 8, below = Math.max(hand ? innerHeight - hand.getBoundingClientRect().top + 8 : 200, small ? 0 : 236);
  const fw = Math.round(Math.max(30, Math.min(small ? (innerWidth - 60) / 6.2 : 80, (innerHeight - top - below - n * 16 - (n + 1) * gap - 14) / (1.36 * n))));
  Object.assign(G.flat.style, { top: top + "px", bottom: below + "px" }); G.flat.style.setProperty("--fw", fw + "px");
  G.flat.replaceChildren(A.el, h("div", { class: "fmid" }, lifeOk ? h("button", { class: "btn sm gold", onclick: () => fieldClick("life") }, "ตี LIFE ฝ่ายตรงข้าม (ตีบ้าน)") : null), B.el);
}
// choosing a target on a computer: an arrow from the attacker follows the mouse and snaps onto a card it may attack
const SVGNS = "http://www.w3.org/2000/svg"; let ptr = null;
addEventListener("pointermove", (e) => { if (e.pointerType === "touch" && !(G && G.dragFrom != null)) return; ptr = { x: e.clientX, y: e.clientY }; if (G && G.att != null) attackArrow(); }, { passive: true });
function attackArrow() {
  let svg = document.getElementById("atkarrow"); const s = G && G.s;
  const from = s && G.att != null && Arena.on && (!touchy() || G.dragFrom != null) && myBattle(s) ? Arena.screenOf(G.att) : null;
  if (!from || !ptr) { if (svg) svg.remove(); return; }
  if (!svg) {
    svg = document.createElementNS(SVGNS, "svg"); svg.id = "atkarrow"; svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<defs><marker id="atkhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ff6a4a"/></marker></defs><path class="glow"/><path class="shaft" marker-end="url(#atkhead)"/><circle class="ret" r="26"/>';
    document.body.append(svg);
  }
  // a card it may attack under the pointer: the arrow ends on that card and a ring marks it
  const ok = new Set(legalMoves(s, whoActs(s)).filter((m) => m.a.type === "attack" && m.a.i === G.att && m.a.ti != null).map((m) => m.a.ti));
  const lifeOk = legalMoves(s, whoActs(s)).some((m) => m.a.type === "attack" && m.a.i === G.att && m.a.tk === "life");
  const tgt = G.hover != null && ok.has(G.hover) ? Arena.screenOf(G.hover) : lifeOk ? Arena.lifeAim() : null;
  const ex = tgt ? tgt.x : ptr.x, ey = tgt ? tgt.y : ptr.y, sx = from.x, sy = from.y - (from.h || 0) * 0.25;
  const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy); if (len < 30) { svg.style.display = "none"; return; } svg.style.display = "";
  const cx = (sx + ex) / 2 - dy * 0.12, cy = (sy + ey) / 2 - Math.min(160, len * 0.35);
  const d = `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
  svg.querySelector(".shaft").setAttribute("d", d); svg.querySelector(".glow").setAttribute("d", d);
  const ret = svg.querySelector(".ret"); ret.style.display = tgt ? "" : "none"; if (tgt) { ret.setAttribute("cx", tgt.x); ret.setAttribute("cy", tgt.y); ret.setAttribute("r", Math.max(18, Math.min(tgt.w, tgt.h) * 0.42)); }
}
function gameMenu(s, V) {
  const me = s.P[V], op = s.P[1 - V];
  if (G.watch) return openSheet((api) => [
    h("div", { class: "row" }, ...[[me, "hell"], [me, "dark"], [op, "hell"], [op, "dark"]].map(([P, z]) => h("button", { class: "btn sm", onclick: () => { api.close(); openPile(P, z); } }, `${ZONE_TH[z]} ${P.name} ${P[z].length}`))),
    h("div", { class: "row" }, s.phase === "over" ? null : h("button", { class: "btn sm", onclick: () => { api.close(); flipWatch(); } }, "สลับฝั่ง"), h("button", { class: "btn sm", onclick: () => { api.close(); soundSheet(); } }, Sfx.on || Music.on ? "🔊 เสียงและเพลง" : "🔇 เสียงและเพลง"),
      h("button", { class: "btn sm danger", onclick: () => { api.close(); exitGame(); } }, "เลิกดู")),
    h("div", { class: "eyebrow" }, "บันทึกเกม"), h("div", { class: "glog", style: "max-height:44vh" }, s.log.slice(-40).reverse().map((l) => h("div", { class: l.s === V ? "mine" : "" }, l.m)))], { title: `ชมเกม · เทิร์น ${s.turn} · ${s.P[s.active].name}` });
  const far = farActs(s, whoActs(s));
  openSheet((api) => [
    far.length ? h("div", { class: "stack", style: "gap:6px" }, h("div", { class: "eyebrow" }, "สั่งใช้ได้ตอนนี้"), h("div", { class: "row" }, far.map((f) => h("button", { class: "btn ciel sm", title: f.title || "", onclick: () => { api.close(); doAct(f.a, whoActs(s)); } }, f.d)))) : null,
    h("div", { class: "row" }, ...[[me, "deck", "Deck"], [me, "hell", "นรกเรา"], [me, "dark", "มิติมืดเรา"], [op, "hell", "นรกคู่แข่ง"]].map(([P, z, t]) => h("button", { class: "btn sm", onclick: () => { api.close(); openPile(P, z); } }, `${t} ${P[z].length}`))),
    isOwner() ? h("div", { class: "row" }, h("button", { class: "btn sm ciel", onclick: () => { api.close(); openAsk(); } }, "✉ ถามชิเอล (แนบสถานะเกม)")) : null,
    h("div", { class: "row" }, h("button", { class: "btn sm ciel", disabled: s.phase === "over", onclick: () => { api.close(); coach().then(() => G && G.coach && openSheet(h("div", { class: "coachbox" }, G.coach), { title: "ชิเอลแนะนำ" })); } }, "ชิเอลแนะนำ"),
      h("button", { class: "btn sm", onclick: () => { api.close(); soundSheet(); } }, Sfx.on || Music.on ? "🔊 เสียงและเพลง" : "🔇 เสียงและเพลง"),
      h("button", { class: "btn sm", onclick: () => { api.close(); snapTable(); } }, "📷 แคปภาพโต๊ะ"),
      h("button", { class: "btn sm", onclick: () => { api.close(); openReport(); } }, "แจ้งปัญหา"),
      undoPoint() >= 0 ? h("button", { class: "btn sm", onclick: () => { api.close(); undoLast(); } }, "↶ ย้อนตา") : null,
      G.puzzle && !G.pzFail && s.phase !== "over" ? h("button", { class: "btn sm ciel", onclick: () => { api.close(); puzzleHint(); } }, "คำใบ้") : null,
      G.replay ? null : h("button", { class: "btn sm", onclick: () => { api.close(); emotePicker(); } }, "💬 อีโมต"),
      s.phase === "over" || G.replay ? null : h("button", { class: "btn sm danger", onclick: () => { api.close(); confirmBox("ยอมแพ้เกมนี้?", "ยอมแพ้", () => doAct({ type: "concede" }, V), true); } }, "ยอมแพ้"),
      h("button", { class: "btn sm danger", onclick: () => { api.close(); s.phase === "over" ? exitGame() : confirmBox("ออกจากสนาม? เกมที่ค้างจะเก็บไว้ให้เล่นต่อ", "ออก", exitGame); } }, "ออกจากสนาม")),
    G.coach ? h("div", { class: "coachbox" }, G.coach) : null,
    h("div", { class: "eyebrow" }, "บันทึกเกม"), h("div", { class: "glog", style: "max-height:44vh" }, s.log.slice(-40).reverse().map((l) => h("div", { class: l.s === V ? "mine" : "" }, l.m)))], { title: `เทิร์น ${s.turn} · ${s.P[s.active].name}` });
}
// one of our cards prints a "สั่งใช้" ability for the zone it is in, but no button is offered: the reason, in the order a
// player would check it (whose turn, which phase, something still resolving, already used, blocked, its own cost/condition)
function whyNoAct(s, x, L, V, sc, d) {
  if (L.z === "land") L = { ...L, p: V }; // Land Magic: either player may use it
  if (L.p !== V || s.phase === "over" || G.watch || G.replay) return "";
  const zoneOf = { av: "field", cs: "field", land: "field", mg: "field", hand: "hand", hell: "hell", dark: "dark" }[L.z];
  const printed = activations(d.x || "").filter((a) => a.where === zoneOf && !a.timed); if (!printed.length) return "";
  const battleOk = !!(sc && sc.activate && sc.activate.battle);
  if (s.active !== V) return "ใช้ได้ในตาของเราเท่านั้น";
  if (s.phase !== "main" && !(s.phase === "battle" && battleOk)) return battleOk ? "ใช้ได้ช่วง Main Phase หรือ Battle Phase ของเรา" : "ใช้ได้ช่วง Main Phase ของเรา";
  if (s.trig.length || s.pend || s.rw) return "รอเอฟเฟกต์หรือการโจมตีที่กำลังเกิดขึ้นให้จบก่อน";
  if ((sc && sc.activate && !sc.activate.multi && x.used === s.turn) || (!sc && x.ua && printed.every((a) => a.once && x.ua[a.k] === s.turn))) return "ใช้ความสามารถนี้ไปแล้วในเทิร์นนี้";
  if (x.mute) return "การ์ดใบนี้เสียความสามารถอยู่";
  if (x.noAct === s.turn || x.nact || E.actBlocked(s, V, x) || E.actOnly(s, V, x, L) || E.hospital(s, V, x)) return "มีผลของการ์ดอื่นห้ามใช้ความสามารถของการ์ดใบนี้อยู่";
  const need = sc && sc.activate && sc.activate.need; return (typeof need === "function" ? need(E, s, x, L) : need) || "ยังไม่ครบค่าใช้จ่ายหรือเงื่อนไขของความสามารถ (ข้อความก่อนลูกศร →)";
}
// the "สั่งใช้" abilities of a card that can be used right now (buttons), or else why not (a note); the phone card view
// and the desktop inspector both show these
function abilityActs(s, x, L, hasOther) {
  const p = whoActs(s), V = view(), d = E.def(s, x), sc = scriptOf(s, x), out = []; const myMove = p != null && mine(p);
  if (L.z === "land" && p != null) L = { ...L, p }; // Land Magic is shared: its abilities are for whoever is playing
  const myMain = myMove && s.active === p && s.phase === "main" && !s.trig.length && !s.pend;
  const myBattle = myMove && s.active === p && s.phase === "battle" && !s.trig.length && !s.pend && !s.rw;
  if (sc && sc.activate && L.p === p && (myMain || (myBattle && sc.activate.battle)) && x.used !== s.turn && sc.activate.can(E, s, x, L)) out.push([sc.activate.label, () => doAct({ type: "activate", i: x.i }, p), "ciel"]);
  if (!sc && L.p === p && myMain && E.ext.acts) for (const a of E.ext.acts(s, x, L)) out.push(["สั่งใช้: " + a.label, () => doAct({ type: "activate", i: x.i, k: a.k }, p), "ciel"]);
  if (L.z === "mg" && L.p === p && myMain && E.krakenCan(s, p, x)) out.push(["ทิ้งการ์ดบนมือ 2 ใบ: อัญเชิญกลับจาก Magic Zone (ความสามารถที่ได้จากคราเค่น)", () => doAct({ type: "activate", i: x.i, k: "kraken" }, p), "ciel"]);
  if (!out.length && !hasOther) { const why = whyNoAct(s, x, L, V, sc, d); if (why) out.push(["สั่งใช้ตอนนี้ไม่ได้: " + why, null, "note"]); }
  return out;
}
// abilities with no card on the table to tap: used from the hand, hell, the dark zone or the deck (and Magic cast from
// hell). The desktop turn bar shows them; the game menu lists them on every screen (the phone bar has room for two buttons)
function farActs(s, p) {
  if (p == null || !mine(p) || s.trig.length || s.pend || s.rw || (s.phase === "mull" || s.phase === "toss") || s.active !== p || G.replay || G.watch) return [];
  const main = s.phase === "main"; if (!main && s.phase !== "battle") return [];
  const P = s.P[p]; const zones = main ? [...P.hand, ...P.hell, ...P.dark, ...uniqDeckActs(s, P)] : [...P.hand, ...P.hell, ...P.dark, ...P.mg];
  const out = zones.filter((x) => { const sc = scriptOf(s, x); return sc && sc.activate && (main || sc.activate.battle) && x.used !== s.turn && sc.activate.can(E, s, x, E.locate(s, x.i)); })
    .map((x) => ({ d: `สั่งใช้ ${E.name(s, x)} (${ZONE_TH[E.locate(s, x.i).z]})`, title: scriptOf(s, x).activate.label, a: { type: "activate", i: x.i } }));
  if (main) out.push(...legalMoves(s, p).filter((m) => m.a.type === "cast" && m.a.from === "hell").map((m) => ({ d: m.d, a: m.a })));
  return out;
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
    else if (d.t === "M" && d.st === "R" && (!s.mu[p].R || E.extraMagic(s, p, x))) acts.push(["ใช้ React", () => { G.castFor = x.i; draw(); }, "gold"]);
    else if (d.t === "M" && d.st === "D" && main && (!s.mu[p].D || E.extraMagic(s, p, x))) acts.push(["สวมใส่ให้ Avatar…", () => handClick(x), "gold"]);
    else if (d.t === "M" && main && (!s.mu[p][d.st] || E.extraMagic(s, p, x))) acts.push(["ใช้ Magic…", () => { G.castFor = x.i; draw(); }, "gold"]);
  }
  if (L.z === "av" && L.p === p && myMove && s.phase === "battle" && s.active === p && !s.pend && !s.trig.length && x.a) acts.push(["โจมตีด้วยใบนี้", () => { G.att = x.i; Arena.select(x.i); draw(); }, "gold"]);
  if (G.att && L.p !== p && (L.z === "av" || L.z === "cs") && myMove) acts.push(["โจมตีใบนี้", () => attack(G.att, L.z, x.i), "gold"]);
  if (G.host && L.z === "av") acts.push(["สวมใส่ให้ใบนี้", () => { const host = G.host; G.host = null; doAct({ type: "cast", i: host, on: x.i }, V); }, "gold"]);
  const sc = scriptOf(s, x); const myMain = myMove && s.active === p && s.phase === "main" && !s.trig.length && !s.pend;
  if (sc && sc.handCall && L.z === "hand" && myMain && s.P[p].hand.some((y) => y.i !== x.i && String(E.def(s, y).sy || "").includes("มังกร"))) acts.push(["ทิ้งเพื่ออัญเชิญมังกร (Cost -6)", () => { G.callVia = x.i; draw(); }, "ciel"]);
  acts.push(...abilityActs(s, x, L, acts.some((a) => a[2] === "ciel")));
  if (E.untargetable(s, x)) acts.push(["ถูกโจมตีไม่ได้ตอนนี้", null, "note"]);
  { const pn = powerNote(s, x, L); if (pn) acts.push([pn, null, "note"]); }
  const stat = [ZONE_TH[L.z], d.t === "M" ? "Magic " + SUB_TH[d.st] : d.t === "T" ? "Token" : "Cost " + (d.c ?? 0), "GEM " + (d.g || 0) + (d.gc ? " (" + d.gc + ")" : ""), d.pw != null || L.z === "av" ? "POWER " + (L.z === "av" || L.z === "cs" ? E.power(s, x) : d.pw || 0) : null, L.z === "av" ? (x.a ? "ตื่น" : "นอน") : null, L.z === "av" && x.lk ? "Link กับ " + E.name(s, s.P[L.p].av.find((y) => y.i === x.lkp) || x) : null, d.sy ? "Symbol " + d.sy : null].filter(Boolean);
  if (L.z === "av" && !x.lk && E.linkNames(s, x).length) acts.push([`ยังไม่อยู่ในสถานะ [Link]: ต้องมี ${E.linkNames(s, x).join(" / ")} บน Avatar Zone เรา (เข้า Link ได้เทิร์นละ 1 คู่ ในเทิร์นเรา) ความสามารถหลัง [Link] จึงจะทำงาน`, null, "note"]);
  { const tr = !sc && traits(d); const rules = tr ? [tr.taunt && "ฝ่ายตรงข้ามต้องโจมตีใบนี้เท่านั้น", tr.noControl && "ถูกเปลี่ยนการควบคุมไม่ได้", tr.noAttack && (tr.noAttack(E, s, x) ? "ตอนนี้โจมตีไม่ได้ตามเงื่อนไขบนการ์ด" : "โจมตีได้ (ครบเงื่อนไขบนการ์ด)")].filter(Boolean) : [];
    if (rules.length && (L.z === "av" || L.z === "cs")) acts.push(["กติกาบนการ์ด (คิดให้อัตโนมัติ): " + rules.join(" · "), null, "note"]); }
  { const ra = !(sc && sc.aura) && readAura(d); if ((sc && sc.aura) || ra) acts.push([ra ? "ต่อเนื่อง (คิดให้อัตโนมัติ): " + ra.desc : "ความสามารถต่อเนื่อง คิดให้อัตโนมัติ", null, "note"]); }
  const api = openSheet(() => h("div", { class: "cview" }, c ? holo(h("div", { class: "ccard big", style: "cursor:default" }, artImg(c, undefined, undefined, x.o))) : h("div", { class: "fx" }, "Token " + d.n),
    h("div", { class: "stack", style: "gap:8px;min-width:0" }, h("div", { class: "row", style: "gap:6px" }, stat.map((t) => h("span", { class: "chip" + (/^POWER/.test(t) ? " gold" : "") }, t)), (x.kw || []).map((k) => h("span", { class: "chip good" }, k))),
      acts.some((a) => a[1]) ? h("div", { class: "row acts" }, acts.filter((a) => a[1]).map(([t, fn, cls]) => h("button", { class: "btn " + (cls || ""), onclick: go(fn) }, t))) : null,
      ...acts.filter((a) => !a[1]).map(([t]) => h("div", { class: "cvnote" }, t)), // what the game already applies by itself
      d.x ? fxText(d.x) : h("div", { class: "muted small" }, "ไม่มีข้อความความสามารถ"), kwGloss(d.x))), { title: d.n, sub: s.P[L.p].name });
}
// the same decks again straight away (a random opponent is drawn again); learn mode replays its lesson game
// take-back (local games): rebuild the game from its start without my last deliberate move and everything after it;
// effects resolving on their own, answers and passes are stepped over, so the move undone is the one I actually chose
const UNDO_SKIP = new Set(["trig", "respond", "pass", "answer", "tossVote", "tossRoll", "tossPick"]);
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
  G.pick = null; G.att = null; G.host = null; G.payFor = null; G.payVia = null; G.callVia = null; G.helperPick = null; G.castFor = null; G.tk = null; G.ask = null; G.qAtt = null;
  persist(); Arena.update(s, view(), { reset: true, flush: true }); draw(); drive(); toast("ย้อนตาแล้ว");
}
const undoBtn = () => (undoPoint() >= 0 ? h("button", { class: "btn sm", title: "ย้อนตาล่าสุด (Ctrl+Z)", onclick: undoLast }, "↶ ย้อนตา") : null);
// turning a phone or resizing the window lays the HUD out again (the phone and desktop layouts differ)
let resizeT = 0; addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (G && G.hud && G.s) draw(); }, 200); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && G && G.s && (G.sel != null || G.att != null) && !document.querySelector(".scrim")) { closePicked(); return; } if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && G && !G.replay && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "")) { e.preventDefault(); undoLast(); } });
function rematch() { const learn = G && G.learn, mode = G && G.mode, fish = G && G.fish, gs = G && G.gs; stopGame(true); if (learn) startLearn(); else if (gs) startGauntlet(gs - 1); else startLocal(fish ? "goldfish" : mode === "solo" ? "solo" : "bot"); }
function exitGame() { if (G && G.replay) { stopGame(false); location.hash = "#history"; return; } const over = G && G.s && G.s.phase === "over"; stopGame(over); location.hash = "#play"; }
function turnButtons(s, p) {
  if (G.puzzle && !G.replay) { // puzzles: what to do after winning or running out of turn, and a hint while playing
    const choose = h("button", { class: "btn sm", onclick: () => { stopGame(true); location.hash = "#play"; } }, "เลือกโจทย์อื่น");
    if (s.phase === "over" && s.winner === G.V) return [h("button", { class: "btn gold sm", onclick: puzzleNext }, "โจทย์ถัดไป"), choose];
    if (s.phase === "over" || G.pzFail) return [undoBtn(), h("button", { class: "btn gold sm", onclick: puzzleRestart }, "เริ่มโจทย์ใหม่"), choose];
    const b = turnButtons0(s, p); if (!(p === G.V && mine(p) && !s.trig.length && !s.pend && s.phase !== "mull" && s.phase !== "toss")) return b;
    const hint = h("button", { class: "btn ciel sm", onclick: puzzleHint }, "คำใบ้"); return compact() ? [hint, ...b] : [...b, hint]; // the phone bar shows only two
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
  if (p == null || !mine(p) || s.trig.length || s.pend || s.rw || (s.phase === "mull" || s.phase === "toss")) return []; // a React moment is answered in its box
  const farBtns = (n) => farActs(s, p).slice(0, n).map((f) => h("button", { class: "btn ciel sm", title: f.title || "", onclick: () => doAct(f.a, p) }, f.d));
  if (s.phase === "main") return [h("button", { class: "btn gold sm", onclick: () => doAct({ type: "battle" }, p) }, s.turn === 1 ? "จบเทิร์น" : "ไป Battle Phase"), s.turn === 1 ? null : h("button", { class: "btn sm", onclick: () => doAct({ type: "end" }, p) }, "จบเทิร์นเลย"), compact() ? null : undoBtn(), ...farBtns(6)];
  if (s.phase === "battle") return [h("button", { class: "btn gold sm", onclick: () => doAct({ type: "end" }, p) }, "จบเทิร์น"), G.att ? h("button", { class: "btn sm", onclick: () => { G.att = null; draw(); } }, "ยกเลิกการเลือก") : compact() ? null : undoBtn(), ...farBtns(4)];
  return [];
}
// desktop: big hover preview (image + readable text side by side); pinned to the selected card otherwise
function drawInspector() {
  const el = document.getElementById("insp"); if (!el || !G) return; const s = G.s;
  // the card just attacked stays quiet under the pointer (no preview popping up after the attack) until the pointer leaves it
  const hov = G.hover != null && G.hover === G.muteHover ? null : G.hover;
  const hi = G.hoverHand != null ? G.hoverHand : hov ?? G.sel; const L = hi != null && E.locate(s, hi);
  // aiming an attack: no big preview over the table at all (it covers the cards being aimed at, even when it shows our own
  // attacker); the arrow and the ring show what is going on, and a right-click still opens a card
  const aiming = G.att != null && G.hoverHand == null;
  if (!L || aiming) { el.className = "inspector glass"; el.replaceChildren(); drawCardActs(); return; }
  const x = L.x, d = E.def(s, x); const c = d.im != null ? card(d.im) : null; const pinned = G.hoverHand == null && G.hover == null;
  const stat = [L.z === "hand" ? null : ZONE_TH[L.z], d.t === "M" ? "Magic " + SUB_TH[d.st] : d.t === "T" ? "Token" : "Cost " + (d.c ?? 0), "GEM " + (d.g || 0) + (d.gc ? " (" + d.gc + ")" : ""), d.t === "A" || d.t === "T" || d.t === "C" ? "POWER " + (L.z === "av" || L.z === "cs" ? E.power(s, x) : d.pw || 0) : null, L.z === "av" ? (x.a ? "ตื่น" : "นอน") : null, d.sy ? d.sy : null].filter(Boolean);
  // the preview goes to the other half of the screen from the card, so it never sits on the card being looked at
  const at = L.z === "hand" ? G.hoverEl && G.hoverEl.isConnected && G.hoverEl.getBoundingClientRect() : Arena.screenOf(x.i); const ax = at ? (at.left != null && at.width != null ? at.left + at.width / 2 : at.x) : 0;
  el.className = "inspector glass show" + (pinned ? " pinned" : "") + (at && ax < innerWidth * 0.5 ? " right" : "");
  // what this card can do now: "คลิกการ์ดเพื่อสั่งใช้" while hovered, the buttons themselves once clicked (above the card), or why not
  const acts = L.z !== "hand" && !G.replay ? abilityActs(s, x, L, false) : [];
  const can = acts.filter((a) => a[1]).map(([t]) => t);
  el.replaceChildren(c ? artImg(c, undefined, undefined, x.o) : h("div", { class: "tok" }, "Token"),
    h("div", { class: "txt" }, h("b", null, d.n), h("div", { class: "row", style: "gap:5px" }, stat.map((t) => h("span", { class: "chip" + (/^POWER/.test(t) ? " gold" : "") }, t)), (x.kw || []).map((k) => h("span", { class: "chip good" }, k))),
      can.length ? h("div", { class: "cvnote canuse" }, (pinned ? "สั่งใช้ได้ (ปุ่มอยู่ที่การ์ด): " : "สั่งใช้ได้ คลิกที่การ์ด: ") + can.join(" · ")) : null,
      ...acts.filter((a) => !a[1]).map(([t]) => h("div", { class: "cvnote" }, t)),
      (() => { const pn = L.z !== "hand" && powerNote(s, x, L); return pn ? h("div", { class: "cvnote" }, pn) : null; })(),
      d.x ? fxText(d.x) : h("div", { class: "muted small" }, "ไม่มีข้อความความสามารถ")),
    h("div", { class: "morehint" }, "เลื่อนลูกกลิ้งเมาส์เพื่ออ่านต่อ · คลิกขวาเปิดการ์ดเต็ม"));
  fitInspector(el);
  drawCardActs();
}
// a long effect never gets cut off: smaller type first (two steps), then the wheel scrolls the text while the card is
// pointed at (the preview itself never takes the mouse), and a right-click opens the whole card
function fitInspector(el) {
  const tx = el.querySelector(".txt"); if (!tx) return; const over = () => tx.scrollHeight > tx.clientHeight + 2;
  el.classList.remove("dense", "denser", "more"); tx.scrollTop = 0;
  if (over()) el.classList.add("dense"); if (over()) el.classList.add("denser"); if (over()) el.classList.add("more");
}
addEventListener("wheel", (e) => {
  if (!G || !G.s || (G.hoverHand == null && G.hover == null)) return; const el = document.getElementById("insp");
  const tx = el && el.classList.contains("show") && el.querySelector(".txt"); if (!tx || tx.scrollHeight <= tx.clientHeight + 2) return;
  tx.scrollTop += e.deltaMode === 1 ? e.deltaY * 18 : e.deltaY; e.preventDefault();
}, { passive: false });
// desktop: the buttons of the clicked card sit just above it on the table (the preview never takes clicks), with ✕;
// a click on the empty table or Esc closes them too
function drawCardActs() {
  let box = document.getElementById("cardacts"); const s = G && G.s;
  const L = s && G.sel != null && !G.replay && !touchy() ? E.locate(s, G.sel) : null;
  const btns = L && L.z !== "hand" ? abilityActs(s, L.x, L, true).filter((a) => a[1]) : [];
  if (!btns.length) { if (box) box.remove(); return; }
  // above the card on the 3D table; without the 3D table (no WebGL), in the middle of the screen above the hand
  const at = Arena.screenOf(G.sel) || { x: innerWidth / 2, top: innerHeight * 0.6 };
  if (!box || !box.isConnected) { if (box) box.remove(); box = h("div", { id: "cardacts", class: "cardacts glass", role: "group", "aria-label": "สั่งใช้การ์ดใบนี้" }); G.hud.append(box); }
  box.replaceChildren(...btns.map(([t, fn]) => h("button", { class: "btn ciel sm", onclick: () => { G.sel = null; Arena.select(null); fn(); drawInspector(); } }, t)),
    h("button", { class: "btn sm", title: "ปิด (Esc)", "aria-label": "ปิด", onclick: closePicked }, "✕"));
  box.style.left = Math.max(12, Math.min(innerWidth - 12, at.x)) + "px"; box.style.top = Math.max(70, at.top - 10) + "px";
}
function handZone(s, V, p) {
  const P = s.P[V]; const n = P.hand.length; const row = compact(); const zone = h("div", { class: row ? "handzone handrow" : "handzone", "aria-label": "การ์ดบนมือ" });
  const w = Math.min(760, innerWidth * 0.92); const cw = Math.round(Math.max(86, Math.min(128, innerHeight * 0.19))); const gap = Math.min(cw * 0.78, (w - cw) / Math.max(1, n - 1));
  const sel = G.pick || []; const canPlay = p != null && mine(p) && p === V;
  // the cards that can be played right now glow green, as in other card games (not while picking GEM, a mulligan or a discard)
  const choosing = G.payFor || G.host || G.castFor || G.callVia != null || G.helperPick || s.phase === "mull" || (s.phase === "end" && s.need) || s.trig.length;
  const can = canPlay && !choosing ? playableNow(s, p) : null;
  // a card that just came into the hand slides in from the Deck's side; the clock is kept per card, so a redraw in
  // the middle of the slide carries on from where it was (negative delay) instead of starting over or jumping
  const now = performance.now(), born = G.handBorn || (G.handBorn = new Map()), first = !G.handSeenView || G.handSeenView !== V + ":" + (G.id || "");
  if (first) { G.handSeenView = V + ":" + (G.id || ""); born.clear(); } let nNew = 0;
  for (const i of [...born.keys()]) if (!P.hand.some((x) => x.i === i)) born.delete(i);
  P.hand.forEach((x, k) => {
    if (!born.has(x.i)) born.set(x.i, now + 70 * nNew++);
    const d = E.def(s, x); const off = k - (n - 1) / 2; const c = d.im != null ? card(d.im) : null;
    const age = now - born.get(x.i), fresh = age < 520;
    // the fan: the outer cards dip and turn, but a big hand does not sink below the screen (at most 26px, 16°)
    const half = Math.max(1, (n - 1) / 2), f = off / half, dip = f * f * Math.min(26, 2.2 * half * half), turn = f * Math.min(16, 3.2 * half);
    const ok = can && can.has(x.c);
    const b = h("button", { class: "hcard" + (sel.includes(x.i) ? " sel" : "") + (fresh ? " fresh" : "") + (ok ? " can" : ""), "data-i": x.i, "data-name": d.n, "aria-label": `${d.n} ${TYPE_TH[d.t]} GEM ${d.g || 0}${ok ? " · เล่นได้ตอนนี้" : ""}`, style: (row ? "" : `width:${cw}px;left:${w / 2 - cw / 2 + off * gap}px;transform:translateY(${dip + (sel.includes(x.i) ? -26 : 0)}px) rotate(${turn}deg);z-index:${k};`) + (fresh ? `animation-delay:${Math.round(-age)}ms` : "") },
      c ? artImg(c, undefined, undefined, x.o) : null, h("span", { class: "gem" }, (d.t === "M" ? SUB_TH[d.st][0] : "C" + (d.c ?? 0)) + " · G" + (d.g || 0)),
      touchy() ? h("span", { class: "zoom", role: "button", "aria-label": "ดูการ์ด " + d.n, onclick: (e) => { e.stopPropagation(); cardView(x); } }, "⤢") : null);
    b.addEventListener("mouseenter", () => { G.hover = null; G.hoverEl = b; showHandInspect(x); });
    b.addEventListener("mouseleave", () => { G.hoverHand = null; drawInspector(); });
    b.addEventListener("contextmenu", (e) => { e.preventDefault(); G.hoverHand = null; drawInspector(); cardView(x); });
    b.addEventListener("click", () => { if (Date.now() - (G.dragEnd || 0) < 250) return; const sel = G.payFor || s.phase === "mull" || (s.phase === "end" && s.need) || G.host; if (touchy() && !sel) return cardView(x); handClick(x); });
    b.addEventListener("pointerdown", (e) => dragStart(e, x, b));
    if (!canPlay) b.classList.add("dim");
    zone.append(b);
  });
  return zone;
}
// hand cards that can be played this moment, by card (copies alike): what the rules allow now (a summon, a build, a Magic,
// a hand ability, an answer to an attack), and in a moment the other side just made, the React cards that fit it
function playableNow(s, p) {
  // worked out once per game moment (a redraw for a hover or a selection reuses it): up to 8 ms with ten cards in hand
  const key = [s.id, s.log.length, s.evc || 0, s.turn, s.phase, p, s.P[p].hand.length, s.trig.length, s.rw ? 1 : 0, s.pend ? 1 : 0].join(":");
  if (G.canKey === key && G.canSet) return G.canSet;
  const out = new Set(), P = s.P[p], inHand = (i) => P.hand.find((y) => y.i === i);
  try {
    const on = s.rw ? (s.rw.by !== p ? s.rw : null) : s.pend && s.pend.by !== p ? { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti } : null;
    if (on) for (const x of E.reactsFor(s, p, on)) out.add(x.c);
    if (!s.rw) for (const m of legalMoves(s, p)) { if (m.a.type === "attack") continue; for (const i of [m.a.i, m.a.via]) { const x = i != null ? inHand(i) : null; if (x) out.add(x.c); } }
  } catch (e) { console.warn(e); }
  G.canKey = key; G.canSet = out; return out;
}
function showHandInspect(x) { G.hoverHand = x.i; drawInspector(); }
// on a computer a hand card can also be dragged up onto the table to play it, as in other card games: let go above the
// hand and it is played the same as a click (the GEM box, the Magic box, the Avatar to wear it); let go over the hand
// and it goes back. A press that hardly moves stays a click.
function dragStart(e, x, el) {
  if (e.pointerType !== "mouse" || e.button !== 0 || touchy() || !G || !G.s) return;
  const s = G.s, p = whoActs(s); if (p == null || !mine(p) || p !== view() || G.payFor || G.host || (s.phase === "mull" || s.phase === "toss") || (s.phase === "end" && s.need)) return;
  const x0 = e.clientX, y0 = e.clientY, zone = document.querySelector(".hud .handzone"); let ghost = null, off = null;
  const line = () => (zone ? zone.getBoundingClientRect().top + 10 : innerHeight - 220);
  const move = (ev) => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 14) return;
      const r = el.getBoundingClientRect(); off = { x: r.left - x0, y: r.top - y0 }; ghost = el.cloneNode(true); ghost.classList.add("dragghost"); ghost.classList.remove("fresh", "can");
      Object.assign(ghost.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", transform: "rotate(0deg)" }); document.body.append(ghost);
      el.classList.add("dragging"); G.hoverHand = null; drawInspector();
    }
    ghost.style.left = ev.clientX + off.x + "px"; ghost.style.top = ev.clientY + off.y + "px"; ghost.classList.toggle("drop", ev.clientY < line());
  };
  const up = (ev) => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    if (!ghost) return; // hardly moved: the click that follows does it
    const play = ev.type === "pointerup" && ev.clientY < line(); ghost.remove(); el.classList.remove("dragging"); G.dragEnd = Date.now();
    if (play && G && G.s === s) handClick(x);
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
function handClick(x) {
  const s = G.s, p = whoActs(s), V = view(); if (p == null || !mine(p)) return showHandInspect(x);
  const d = E.def(s, x);
  if (G.payFor) { if (x.i === G.payVia) return; const pk = G.pick || []; G.pick = pk.includes(x.i) ? pk.filter((i) => i !== x.i) : x.i === G.payFor ? pk : [...pk, x.i]; return draw(); }
  if (s.phase === "mull" || (s.phase === "end" && s.need)) { const pk = G.pick || []; G.pick = pk.includes(x.i) ? pk.filter((i) => i !== x.i) : [...pk, x.i]; return draw(); }
  if (d.t === "M" && d.st === "R" && !(s.trig.length && !s.rw)) { G.castFor = x.i; return draw(); } // not over an effect's own choice box
  if (s.active !== p || s.phase !== "main" || s.trig.length || s.pend) return showHandInspect(x);
  if (x.borrow) { toast("การ์ดใบนี้ใช้ได้แค่เป็นค่า Cost ในการอัญเชิญ", "bad"); return showHandInspect(x); }
  if (d.t === "A" && E.locked(s, p, x)) return toast("อัญเชิญการ์ดใบนี้ไม่ได้ในเทิร์นนี้ (ผลของการ์ดที่ใช้ไปแล้ว)", "bad");
  if (d.t === "A" && (E.avatars(s.P[p]) >= 4 || s.P[p].av.length >= 6)) { toast("Avatar Zone เต็มแล้ว (Avatar ได้ 4 ใบ)", "bad"); return showHandInspect(x); }
  if (d.t === "A" && (E.hooks(s, x) || {}).noHand) { toast("การ์ดใบนี้ลงสนามจากบนมือไม่ได้", "bad"); return showHandInspect(x); }
  if (d.t === "C" && s.P[p].cs.length >= 3) { toast("Construct Zone เต็มแล้ว (3 ใบ)", "bad"); return showHandInspect(x); }
  if (d.t === "A" || d.t === "C") { const auto = E.autoPay(s, p, x.i);
    if (!auto) {
      // not enough GEM the usual way: a dragon can still come down by discarding ซาร์อึก (Cost −6), from either card
      const via = d.t === "A" ? legalMoves(s, p).find((m) => m.a.type === "summon" && m.a.via != null && (m.a.i === x.i || m.a.via === x.i)) : null;
      if (via && via.a.i !== x.i) { G.callVia = x.i; return draw(); }
      if (via) { G.payFor = x.i; G.payVia = via.a.via; G.pick = via.a.pay || []; return draw(); }
      toast(`GEM บนมือไม่พอจ่าย ${d.n} (Cost ${d.c || 0})`); return showHandInspect(x);
    }
    G.payFor = x.i; G.pick = auto; return draw(); }
  // one Magic of each kind a turn: say so instead of doing nothing (one more is allowed after หอสมุดจอมเวทย์ / อะปัด and the like)
  if (d.t === "M" && d.st !== "L" && s.mu[p][d.st] && !E.extraMagic(s, p, x)) { toast(`เทิร์นนี้ใช้ ${SUB_TH[d.st]} Magic ไปแล้ว 1 ใบ (ใช้เพิ่มได้เมื่อมีความสามารถที่ให้ใช้เพิ่ม เช่น สั่งใช้หอสมุดจอมเวทย์ก่อน)`); return showHandInspect(x); }
  if (d.t === "M" && d.st === "D" && (scriptOf(s, x) || {}).castFree) return doAct({ type: "cast", i: x.i }, p);
  if (d.t === "M" && d.st === "D") { G.host = x.i; return draw(); }
  if (d.t === "M") { G.castFor = x.i; return draw(); } // always confirm before a Magic goes off
  showHandInspect(x);
}
// ── before the game: a die each, or a coin with the two players' pictures, decides who chooses to go first or second ──
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const tossMs = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? { die: 250, coin: 400, tie: 900 } : { die: 1100, coin: 2800, tie: 1500 });
const tossFx = () => (G.tossFx = G.tossFx && G.tossFx.id === G.s.id ? G.tossFx : { id: G.s.id, die: {}, coin: 0 });
// the moment (ms) the toss animations now running are over: nothing is pressed and the bot does not act before it
function tossBusy(s) { const t = s.toss; if (!t || !G) return 0; const fx = tossFx(), ms = tossMs(); let u = 0;
  for (const [k, at] of Object.entries(fx.die)) { const tie = t.m === "dice" && t.win == null && Number(k.split(":")[0]) === t.n - 1; u = Math.max(u, at + ms.die + (tie ? ms.tie : 0)); }
  if (fx.coin) u = Math.max(u, fx.coin + ms.coin); return u; }
function dieEl(v, rolling) { const d = h("div", { class: "die" + (rolling ? " rolling" : v ? "" : " blank") });
  const paint = (n) => d.replaceChildren(...Array.from({ length: 9 }, (_, k) => h("i", { class: (PIPS[n] || []).includes(k) ? "on" : "" })), ...(n ? [] : [h("span", { class: "q" }, "?")]));
  paint(rolling ? 1 + Math.floor(Math.random() * 6) : v || 0);
  if (rolling) { const iv = setInterval(() => { if (!d.isConnected) return clearInterval(iv); paint(1 + Math.floor(Math.random() * 6)); }, 90); }
  return d; }
function tossBox(s) {
  const t = s.toss, V = view(), fx = tossFx(), ms = tossMs(), now = Date.now(); const p = whoActs(s); const live = !G.replay && !G.watch;
  const nm = (q) => s.P[q].name, face = (q) => (s.P[q].bot && !s.P[q].ava ? h("span", { class: "ava xl" }, "✦") : avatarEl(s.P[q].ava, s.P[q].name, "xl"));
  const TH = { dice: "ทอยเต๋า", coin: "โยนเหรียญ" }; const kids = []; const later = (at) => { clearTimeout(fx.timer); fx.timer = setTimeout(() => G && G.s === s && draw(), Math.max(30, at - Date.now() + 40)); };
  if (t.m == null) { // the vote
    kids.push(h("div", { class: "tiny muted" }, "เลือกวิธีเสี่ยงทาย ผู้ชนะได้เลือกว่าจะเริ่มก่อนหรือทีหลัง · ถ้าเลือกไม่ตรงกัน ระบบสุ่มหนึ่งในสองวิธีให้"));
    kids.push(h("div", { class: "tossvote" }, ...[["dice", "🎲", "ทอยเต๋า", "ทอยคนละลูก แต้มมากกว่าได้เลือก"], ["coin", "🪙", "โยนเหรียญ", "เหรียญสองหน้าเป็นรูปของทั้งสองฝ่าย หน้าใครออก คนนั้นได้เลือก"]].map(([m, ic, name, sub]) =>
      h("button", { class: "tosscard" + (live && mine(p) && t.vote[p] === m ? " on" : ""), disabled: !(live && mine(p) && t.vote[p] == null), onclick: () => doAct({ type: "tossVote", m }, p) }, h("span", { class: "ic" }, ic), h("b", null, name), h("small", null, sub)))));
    kids.push(h("div", { class: "tossstat" }, ...[V, 1 - V].map((q) => h("span", { class: t.vote[q] ? "ok" : "" }, `${nm(q)}: ${t.vote[q] ? "เลือกแล้ว ✓" : q === p ? "กำลังเลือก…" : "รอ"}`))));
  } else {
    if (t.split) kids.push(h("div", { class: "tiny", style: "color:var(--gold)" }, `เลือกไม่ตรงกัน (${nm(0)}: ${TH[t.vote[0]]} · ${nm(1)}: ${TH[t.vote[1]]}) ระบบสุ่มได้: ${TH[t.m]}`));
    if (t.m === "dice") { // a die each
      const tieShow = t.win == null && t.tie && t.roll[0] == null && t.roll[1] == null && now < Math.max(...[0, 1].map((q) => (fx.die[`${t.n - 1}:${q}`] = fx.die[`${t.n - 1}:${q}`] || now))) + ms.die + ms.tie;
      const val = (q) => (tieShow ? t.tie[q] : t.roll[q]), key = (q) => `${tieShow ? t.n - 1 : t.n}:${q}`;
      for (const q of [0, 1]) if (val(q) != null && !fx.die[key(q)]) fx.die[key(q)] = now; // both dice are timed before either column is drawn
      const col = (q) => { const v = val(q); if (v != null && !fx.die[key(q)]) fx.die[key(q)] = now; const rolling = v != null && now - fx.die[key(q)] < ms.die; if (rolling) later(fx.die[key(q)] + ms.die);
        return h("div", { class: "tosscol" + (t.win === q && !rolling && now >= tossBusy(s) ? " win" : "") }, face(q), h("b", null, nm(q)), dieEl(rolling ? 0 : v, rolling), h("span", { class: "tiny muted" }, v == null ? (q === p ? "รอทอย" : "รอ") : rolling ? "กำลังทอย…" : `ได้ ${v}`)); };
      kids.push(h("div", { class: "tossrow" }, col(V), h("span", { class: "vs" }, "VS"), col(1 - V)));
      if (tieShow) { kids.push(h("div", { class: "small", style: "font-weight:700;color:var(--warn)" }, "แต้มเท่ากัน ทอยใหม่ทั้งสองฝ่าย")); later(tossBusy(s)); }
      else if (t.win == null) kids.push(h("div", { class: "row" }, live && mine(p) && now >= tossBusy(s) ? h("button", { class: "btn gold", onclick: () => doAct({ type: "tossRoll" }, p) }, G.mode === "solo" ? `${nm(p)}: ทอยเต๋า` : "ทอยเต๋า") : h("span", { class: "tiny muted" }, now < tossBusy(s) ? "…" : `รอ ${nm(p)} ทอย…`)));
      if (now < tossBusy(s)) later(tossBusy(s));
    } else { // the coin: our picture on one side, theirs on the other
      if (!fx.coin) fx.coin = now; const spinning = now - fx.coin < ms.coin; const end = 360 * 7 + (t.win === V ? 0 : 180);
      const coin = h("div", { class: "coin" }, h("div", { class: "face front" }, face(V)), h("div", { class: "face back" }, face(1 - V)));
      try { const an = coin.animate([{ transform: "translateY(0) rotateY(0deg) scale(1)" }, { transform: `translateY(-64px) rotateY(${end * 0.55}deg) scale(1.18)`, offset: 0.45 }, { transform: `translateY(0) rotateY(${end}deg) scale(1)` }], { duration: ms.coin, easing: "cubic-bezier(.25,.6,.3,1)", fill: "forwards" }); an.currentTime = Math.min(ms.coin, now - fx.coin); } catch { coin.style.transform = `rotateY(${end}deg)`; }
      kids.push(h("div", { class: "coinbox" }, coin), h("div", { class: "tossstat" }, h("span", null, `หน้าหนึ่ง: ${nm(V)}`), h("span", null, `อีกหน้า: ${nm(1 - V)}`)));
      if (spinning) { kids.push(h("div", { class: "tiny muted" }, "กำลังโยนเหรียญ…")); later(fx.coin + ms.coin); }
    }
    if (t.win != null && now >= tossBusy(s)) { // the winner's choice
      kids.push(h("div", { class: "small", style: "font-weight:700;color:var(--gold)" }, t.m === "coin" ? `เหรียญออกหน้า ${nm(t.win)}` : `${nm(t.win)} แต้มมากกว่า (${t.roll[t.win]} ต่อ ${t.roll[1 - t.win]})`));
      kids.push(live && mine(t.win) ? h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => doAct({ type: "tossPick", first: true }, t.win) }, G.mode === "solo" ? `${nm(t.win)}: เริ่มก่อน` : "เริ่มก่อน"), h("button", { class: "btn", onclick: () => doAct({ type: "tossPick", first: false }, t.win) }, "เริ่มทีหลัง"))
        : h("div", { class: "tiny muted" }, `รอ ${nm(t.win)} เลือกว่าจะเริ่มก่อนหรือทีหลัง…`));
    }
  }
  return h("div", { class: "prompt glass toss" }, h("b", { style: "font-family:var(--f-display)" }, "ใครได้เลือกเริ่มก่อน?"), ...kids);
}
// the abilities waiting their turn (Master Duel shows its chain, MTG Arena its stack): which runs now, whose each is, in order
function trigQueue(s) {
  const who = (q) => (q === G.V ? "คุณ" : s.P[q].name); const list = s.trig.slice(0, 5);
  return h("div", { class: "tiny muted", style: "line-height:1.5", "aria-label": "ลำดับเอฟเฟกต์ที่รอทำงาน" }, "ลำดับเอฟเฟกต์: ",
    ...list.flatMap((t, k) => [k ? " → " : "", h(k ? "span" : "b", { style: k ? "" : "color:var(--gold-hi)" }, `${k + 1}) ${(s.cards[t.c] || {}).n || "เอฟเฟกต์"} (${who(t.seat)})`)]), s.trig.length > 5 ? ` → อีก ${s.trig.length - 5}` : "");
}
// screen readers and keyboard players: regions that stay on the page (the HUD is rebuilt on every draw, and a live region
// made anew is not read out): new log lines (polite) and a prompt that has just appeared for us (assertive); after keyboard
// use, focus moves to the new prompt's first button when it had nowhere to be
let kbUsed = false; addEventListener("keydown", (e) => { if (e.key === "Tab" || e.key === "Enter" || e.key === " ") kbUsed = true; }, true); addEventListener("pointerdown", () => { kbUsed = false; }, true);
const srRegion = (id, live) => document.getElementById(id) || document.body.appendChild(h("div", { id, class: "sr-only", "aria-live": live, "aria-atomic": "true" }));
function sayLog(s) { const n = s.log.length; if (G.saidLog == null || n < G.saidLog) { G.saidLog = n; return; } if (n === G.saidLog) return; const lines = s.log.slice(Math.max(G.saidLog, n - 3)).map((l) => l.m); G.saidLog = n; srRegion("srlog", "polite").textContent = lines.join(" · "); }
function announcePrompt(el, p) {
  if (!el || p == null || !mine(p)) return el; const t = ((el.querySelector("b") || el).textContent || "").replace(/\s+/g, " ").trim().slice(0, 220); if (!t || t === G.saidPrompt) return el; G.saidPrompt = t;
  setTimeout(() => { srRegion("srlive", "assertive").textContent = t; const a = document.activeElement; if (kbUsed && el.isConnected && (!a || a === document.body || !a.isConnected)) { const f = el.querySelector("button:not([disabled])") || el.querySelector("[tabindex]:not([tabindex='-1'])"); if (f) f.focus({ preventScroll: true }); } });
  return el; }
function promptBox(s, p) {
  if (s.phase === "toss" && s.toss) return G && G.replay ? null : tossBox(s); // a replay never shows the toss's live choices
  try { const el = promptBox0(s, p); if (el && s.trig.length >= 2 && !s.rw) el.append(trigQueue(s)); return announcePrompt(el, p); } catch (e) {
    console.warn(e); const t = s.trig[0]; if (!t || !mine(p)) return null; const d = s.cards[t.c] || {};
    return h("div", { class: "prompt glass" }, h("b", { style: "font-family:var(--f-display)" }, `${d.n || "เอฟเฟกต์"}: แสดงตัวเลือกไม่ได้`),
      ...trigEscape(s, t, p, "ระบบเลือกให้แบบอัตโนมัติได้ หรือข้ามเอฟเฟกต์นี้ แจ้งปัญหาได้จากเมนู ☰"));
  }
}
function promptBox0(s, p) {
  if (p == null || !mine(p)) return null; const P = s.P[p];
  const box = (title, ...kids) => h("div", { class: "prompt glass" }, h("b", { style: "font-family:var(--f-display)" }, title), ...kids);
  // the same box set low on a phone (over the hand): for answers to an attack, where our Avatars and their POWER must stay in view
  const boxLow = (title, ...kids) => { const b = box(title, ...kids); b.classList.add("low"); return b; };
  if (G.payFor && !(s.phase === "main" && s.active === p && !s.pend && !s.trig.length)) { G.payFor = null; G.pick = null; }
  if (G.payFor) {
    const x = P.hand.find((y) => y.i === G.payFor); if (!x) { G.payFor = null; return null; }
    const d = E.def(s, x); const cost = Math.max(0, E.costOf(s, p, x) - (G.payVia != null ? 6 : 0)); const r = E.canPay(s, p, d, G.pick || [], cost);
    const sc = scriptOf(s, x); const canCall = sc && sc.handCall && G.payVia == null && P.hand.some((y) => y.i !== x.i && String(E.def(s, y).sy || "").includes("มังกร"));
    return box(`${G.payVia != null ? "ทิ้งซาร์อึก แล้วอัญเชิญแบบจุติ" : d.t === "A" ? "อัญเชิญ" : "ก่อสร้าง"} ${d.n} · Cost ${cost}${cost !== (d.c || 0) ? ` (ปกติ ${d.c || 0})` : ""}`,
      !touchy() && d.x ? fxText(d.x, "small", "max-height:132px;overflow:auto") : null,
      h("div", { class: "small muted" }, cost ? "แตะการ์ดบนมือเพื่อเลือกจ่าย GEM (ทิ้งลงนรก) ระบบเลือกชุดที่เสียน้อยให้แล้ว" : "ไม่ต้องจ่าย GEM"),
      G.payVia != null ? h("div", { class: "small", style: "color:var(--warn)" }, "หลังจากนี้ทั้งเกม จะอัญเชิญได้เฉพาะมังกรหรือผู้ฝึกมังกร") : null,
      h("div", { class: "small " + (r.ok ? "" : "muted"), style: r.ok ? "color:#8ee3b2" : "" }, r.ok ? `จ่าย GEM ${r.total}/${cost}${r.exact ? " · พอดี" : ""}` : r.err),
      h("div", { class: "row" }, h("button", { class: "btn gold", disabled: !r.ok, onclick: () => { const pay = G.pick; const via = G.payVia; G.payFor = null; G.payVia = null; doAct({ type: d.t === "A" ? "summon" : "build", i: x.i, pay, ...(via != null ? { via } : {}) }, p); } }, "ยืนยัน"),
        canCall ? h("button", { class: "btn ciel sm", onclick: () => { G.payFor = null; G.pick = null; G.callVia = x.i; draw(); } }, "ทิ้งจากมือเพื่ออัญเชิญมังกรแทน") : null,
        h("button", { class: "btn", onclick: () => { G.payFor = null; G.payVia = null; G.pick = null; draw(); } }, "ยกเลิก")));
  }
  if (G.callVia != null) {
    const via = P.hand.find((y) => y.i === G.callVia); const drs = P.hand.filter((y) => y.i !== G.callVia && E.def(s, y).t === "A" && String(E.def(s, y).sy || "").includes("มังกร"));
    if (!via || !drs.length || !(s.phase === "main" && s.active === p)) { G.callVia = null; } else
      return box("ซาร์อึก: เลือกมังกรบนมือที่จะอัญเชิญ (Cost -6)", h("div", { class: "pick" }, drs.map((y) => cardBtn(E.def(s, y).im, { seat: y.o, info: () => cardView(y), badge: "C" + Math.max(0, E.costOf(s, p, y) - 6), onclick: () => { const c = Math.max(0, E.costOf(s, p, y) - 6); G.payFor = y.i; G.payVia = via.i; G.callVia = null; G.pick = E.autoPay(s, p, y.i, c, [via.i]) || []; draw(); } }))),
        h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { G.callVia = null; draw(); } }, "ยกเลิก")));
  }
  if (G.castFor) {
    const x = P.hand.find((y) => y.i === G.castFor); const d = x && E.def(s, x);
    const usedR = !!x && d.st === "R" && !!s.mu[p].R && !E.extraMagic(s, p, x); // a React already used this turn (and no right to one more): say so
    const ok = x && (d.st === "R" ? (usedR || !s.mu[p].R) && !(s.trig.length && !s.rw) : s.phase === "main" && s.active === p && !s.trig.length && !s.pend && (!s.mu[p][d.st] || E.extraMagic(s, p, x))); // an effect's own choice comes first · one Magic of a kind a turn, unless one more is allowed (หอสมุดจอมเวทย์, อะปัด)
    if (!ok) { G.castFor = null; } else {
      const on = s.rw && s.rw.by !== p ? s.rw : s.pend && s.pend.by !== p ? { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti } : null;
      let fx = null, asks = null; try { const r = resolveEffect(s, { i: x.i, c: x.c, when: "cast", seat: p, ...(d.st === "R" && on ? { on } : {}) }, [], true); if (r && r.ask) asks = r.ask.prompt; else fx = r; } catch (e) { console.warn(e); } const empty = !s.P[p].av.length && /Avatar[^:]*(ฝ่ายเรา|ของเรา|Zone\s*เรา)|เลือก\s*Avatar/.test(d.x || "");
      // React: only inside a matching window; scripted canCast: only when its condition holds
      const scx = scriptOf(s, x);
      const KIND_TH = { attack: "ตอนฝ่ายตรงข้ามประกาศโจมตี", summon: "ตอนฝ่ายตรงข้ามอัญเชิญ Avatar", cast: "ตอนฝ่ายตรงข้ามใช้ Magic", phase: "ก่อนฝ่ายตรงข้ามจบ Phase", own: "ในเทิร์นของคุณเอง",
        doom: "ตอน Avatar ของคุณกำลังจะถูกทำลาย (แพ้การต่อสู้ก็นับ)", destroyed: "ตอน Avatar ของคุณถูกทำลาย", left: "ตอน Avatar ของคุณออกจากสนาม", death: "ตอน Avatar ของคุณถูกทำลาย", react: "ตอนฝ่ายตรงข้ามใช้ React", activate: "ตอนฝ่ายตรงข้ามใช้ความสามารถของการ์ด", battle: "ตอนฝ่ายตรงข้ามเข้าสู่ Battle Phase", handed: "ตอนฝ่ายตรงข้ามนำการ์ดจาก Deck ขึ้นมือ" };
      const fightHint = d.st === "R" && rk0(scx, d).some((k) => k === "doom" || k === "destroyed") && s.pend && s.pend.by !== p && !s.rw ? " · ตอนนี้กด “ไม่ตอบโต้ ปล่อยให้โจมตี” ได้เลย ถ้า Avatar ของคุณแพ้ เกมจะถามให้ใช้การ์ดใบนี้ก่อนถูกทำลาย" : "";
      // a React goes off only in a moment the game checks against its text (the button shows up by itself then)
      const rk = scx && scx.react ? [...scx.react.kinds, ...(scx.react.anytime ? ["phase", "own"] : [])] : (reactTiming(d.x) || {}).kinds;
      const anytime = d.st === "R" && !on && scx && scx.react && scx.react.anytime && legalMoves(s, p).some((m) => m.a.type === "cast" && m.a.i === x.i); // no moment written on it: usable in our own turn too
      const block = usedR ? "เทิร์นนี้คุณใช้ React ไปแล้ว 1 ใบ จึงใช้ใบนี้ไม่ได้ (React ใช้ได้เทิร์นละ 1 ใบ)" : d.st === "R" && !anytime ? (!on || !E.reactsFor(s, p, on).includes(x) ? `React ใช้ได้${rk && rk.length ? [...new Set(rk.map((k) => KIND_TH[k] || "ตอนฝ่ายตรงข้ามทำบางอย่าง"))].join(" หรือ ") : "ตอนฝ่ายตรงข้ามทำบางอย่าง"} (และตรงเงื่อนไขบนการ์ด) ตอนนั้นจะมีปุ่มขึ้นให้เอง${fightHint}` : null)
        : scx && scx.canCast && !scx.canCast(E, s, p) ? "ยังไม่ตรงเงื่อนไขการใช้การ์ดใบนี้" : (!scx && fx && fx.fail && fx.explain) || (!scx && E.ext.castFail && E.ext.castFail(s, x, p)) || null;
      if (block) return box(`${d.n}`, fxText(d.x || "", "small", "max-height:150px;overflow:auto"), h("div", { class: "small", style: "color:var(--warn)" }, block),
        h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { G.castFor = null; draw(); } }, "ปิด")));
      return box(`ใช้ ${SUB_TH[d.st]} Magic: ${d.n}?`, fxText(d.x || "ไม่มีข้อความ", "small", "max-height:150px;overflow:auto"),
        asks ? h("div", { class: "small", style: "color:#8ee3b2" }, "ใช้แล้วจะให้เลือก: " + asks) : fx ? h("div", { class: "small", style: "color:#8ee3b2" }, fx.explain) : h("div", { class: "tiny muted" }, "ใช้แล้วระบบทำผลของการ์ดให้อัตโนมัติ"),
        empty ? h("div", { class: "small", style: "color:var(--warn)" }, "ระวัง: ตอนนี้ยังไม่มี Avatar ฝ่ายเราบนสนาม ผลของการ์ดนี้อาจไม่มีเป้าหมาย") : null,
        s.mu[p][d.st] === undefined && d.st !== "R" ? h("div", { class: "tiny muted" }, `Magic ${SUB_TH[d.st]} ใช้ได้เทิร์นละ 1 ใบ`) : null,
        h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { G.castFor = null; doAct({ type: "cast", i: x.i }, p); } }, "ใช้เลย"), h("button", { class: "btn", onclick: () => { G.castFor = null; draw(); } }, "ยกเลิก")));
    }
  }
  if (G.host) {
    const x = P.hand.find((y) => y.i === G.host); if (!x) { G.host = null; return null; }
    const avs = [...s.P[p].av, ...s.P[1 - p].av];
    return box(`สวมใส่ ${E.name(s, x)} ให้ Avatar`, h("div", { class: "pick" }, avs.map((y) => pointAt(cardBtn(E.def(s, y).im, { seat: y.o, info: () => cardView(y), badge: (y.o === p ? "เรา " : "") + copyTag(s, y.i, avs.map((z) => z.i)) + "P" + E.power(s, y), onclick: () => { G.host = null; Arena.select(null); doAct({ type: "cast", i: x.i, on: y.i }, p); } }), y.i))),
      h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => { G.host = null; draw(); } }, "ยกเลิก")));
  }
  if (G.helperPick) {
    const hp = G.helperPick; const ax = P.av.find((y) => y.i === hp.att); const helpers = ax ? E.helpPool(s, p).map((y) => ({ y, hq: E.helpOf(s, p, ax, y) })).filter((z) => z.hq) : [];
    const risky = helpers.some((z) => z.hq.risky && hp.sup.includes(z.y.i));
    return box("เลือกผู้ช่วยโจมตี (สามัคคี / แทงหลัง)", h("div", { class: "pick" }, helpers.map(({ y, hq }) => { const b = cardBtn(E.def(s, y).im, { seat: y.o, info: () => cardView(y), badge: "+" + hq.n + (hq.risky ? " ⚠" : ""), cls: hp.sup.includes(y.i) ? "sel" : "", onclick: () => { hp.sup = hp.sup.includes(y.i) ? hp.sup.filter((i) => i !== y.i) : [...hp.sup, y.i]; draw(); } }); if (hq.risky) b.title = "แทงหลังสีต่างกับผู้โจมตี: ผู้โจมตีจะถูกทำลายเมื่อจบการต่อสู้"; return b; })),
      (() => { const ap = E.power(s, ax), sum = helpers.filter((z) => hp.sup.includes(z.y.i)).reduce((t, z) => t + z.hq.n, 0); const T = hp.tk === "av" || hp.tk === "cs" ? E.locate(s, hp.ti) : null; const tp = T ? E.power(s, T.x) : null;
        return h("div", { class: "small", style: tp != null && ap + sum > tp ? "color:#8ee3b2" : "" }, `POWER ${ap}${sum ? ` + ${sum} = ${ap + sum}` : ""}${tp != null ? ` ต่อ ${E.name(s, T.x)} ${tp}${ap + sum > tp ? " · ชนะ" : ap + sum === tp ? " · เสมอ" : " · ยังไม่ชนะ"}` : ""}`); })(),
      risky ? h("div", { class: "tiny", style: "color:#ffb4a8" }, "⚠ ผู้ช่วยแทงหลังสีต่างกับผู้โจมตี: ผู้โจมตีจะถูกทำลายเมื่อจบการต่อสู้") : null,
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { G.helperPick = null; doAct({ type: "attack", i: hp.att, tk: hp.tk, ti: hp.ti, sup: hp.sup }, p); } }, "โจมตี"), h("button", { class: "btn", onclick: () => { G.helperPick = null; draw(); } }, "ยกเลิก")));
  }
  if (s.phase === "mull") {
    const n = (G.pick || []).length;
    return box("เปลี่ยนมือ (ทำได้ครั้งเดียว)", h("div", { class: "small muted" }, "แตะการ์ดบนมือที่ต้องการส่งกลับ Deck แล้วจั่วใหม่เท่าจำนวนนั้น"),
      h("div", { class: "row" }, h("button", { class: "btn gold", onclick: () => { const ids = G.pick || []; G.pick = null; doAct({ type: "mull", iids: ids }, p); } }, n ? `เปลี่ยน ${n} ใบ` : "เก็บมือเดิม")));
  }
  if (s.rw && s.rw.by !== p) {
    const L = E.locate(s, s.rw.i); const what = s.rw.kind === "battle" ? "เข้าสู่ Battle Phase" : s.rw.kind === "phase" ? (s.rw.ph === "draw" ? "จบ Draw Phase แล้ว (กำลังเริ่ม Main Phase)" : `กำลังจะจบ ${s.rw.ph === "battle" ? "Battle" : "Main"} Phase (เข้าสู่ End Phase)`) : s.rw.kind === "handed" ? (s.rw.pre ? "กำลังจะนำการ์ดจาก Deck ขึ้นมือ (ตอบโต้ได้ก่อนการ์ดออกจาก Deck)" : "นำการ์ดจาก Deck ขึ้นมือ") : L ? `${s.rw.kind === "summon" ? "อัญเชิญ" : s.rw.kind === "activate" ? "ใช้ความสามารถของ" : s.rw.kind === "react" ? "ใช้ React" : "ใช้ Magic"} ${E.name(s, L.x)}` : "เล่นการ์ด";
    const rs = E.reactsFor(s, p, s.rw);
    const fcd = s.rw.kind === "doom" && s.rw.fight ? fightForecast(s) : null; // the fight this destruction comes from: who hit whom
    const doomNames = s.rw.kind === "doom" ? (fcd && fcd.T ? `${fcd.A.p === p ? "ของคุณ " : ""}${tagName(s, fcd.A)} (P${fcd.ap}) ตี → ${fcd.T.p === p ? "ของคุณ " : ""}${tagName(s, fcd.T)} (P${fcd.tp}) · ` : "") + (s.rw.ids || []).map((i) => E.locate(s, i)).filter(Boolean).map((D) => `${tagName(s, D)} (P${E.power(s, D.x)})`).join(", ") : "";
    const hs = s.rw.hand && s.rw.src != null ? E.locate(s, s.rw.src) : null;
    if (s.rw.own) { const A = E.locate(s, s.rw.att), T = s.rw.ti != null ? E.locate(s, s.rw.ti) : null; // our own attack: a React about our fighting Avatar
      return box(`${A ? E.name(s, A.x) : "Avatar"} ของคุณกำลังต่อสู้${T ? "กับ " + E.name(s, T.x) : ""} · จะใช้ React ก่อนตัดสินผลไหม?`,
        h("div", { class: "opts" }, rs.map((x) => h("button", { class: "btn sm gold", onclick: () => doAct({ type: "cast", i: x.i }, p) }, "ใช้ " + E.name(s, x)))),
        h("div", { class: "row" }, h("button", { class: "btn", onclick: () => doAct({ type: "pass" }, p) }, "ไม่ใช้ สู้เลย"))); }
    return boxLow(s.rw.hand ? `${s.P[s.rw.by].name} โจมตี: ความสามารถของ ${hs ? E.name(s, hs.x) : "การ์ด"} กำลังจะทำงานกับการ์ดบนมือคุณ · จะใช้ React ตอบโต้ก่อนไหม?` : s.rw.kind === "destroyed" ? `${L ? E.name(s, L.x) : "Avatar"} ของคุณถูกทำลาย · จะใช้ React ไหม?` : s.rw.kind === "doom" ? `${doomNames} ของคุณ${s.rw.fight ? "แพ้การต่อสู้ และ" : ""}กำลังจะ${s.rw.kill.length || s.rw.killCs.length ? "ถูกทำลาย" : "ออกจากสนาม"} · จะใช้ React ไหม?`.replace(/^(.*) · (.*?) ของคุณแพ้การต่อสู้ และ/, (m, f, d) => `${f}: ${d} ของคุณแพ้การต่อสู้ `) : s.rw.kind === "left" ? `${L ? E.name(s, L.x) : "Avatar"} ของคุณออกจาก Avatar Zone · จะใช้ React ไหม?` : `${s.P[s.rw.by].name} ${what} · จะใช้ React ตอบโต้ไหม?`, L ? h("div", { class: "row small" }, h("button", { class: "btn sm", onclick: () => cardView(L.x) }, "ดูการ์ดนั้น")) : null,
      h("div", { class: "opts" }, rs.map((x) => h("button", { class: "btn sm gold", onclick: () => doAct({ type: "cast", i: x.i }, p) }, "ใช้ " + E.name(s, x)))),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => doAct({ type: "pass" }, p) }, "ไม่ตอบโต้")));
  }
  if (s.trig.length && G.ask && G.tk === s.trig[0].id) {
    const t = s.trig[0]; const d = s.cards[t.c] || {}; const a = G.ask; const sel = G.askSel || [];
    if (a.order) return box(a.prompt, h("div", { class: "opts" }, a.modes.map((t, k) => h("button", { class: "btn sm", onclick: () => { G.tOrd = a.key; G.ask = null; if (k > 0) doAct({ type: "trigFirst", id: a.order[k] }, p); else humanTrig(G.s, p); } }, t))),
      // one press for the whole batch: the abilities listed here run in this order with no more asking (a new one joining asks again)
      h("div", { class: "row" }, h("button", { class: "btn gold sm", onclick: () => { G.tOrdBatch = a.order.slice(); G.tOrd = a.key; G.ask = null; humanTrig(G.s, p); } }, "เรียงตามนี้ทั้งหมด ไม่ต้องถามอีก")));
    if (a.modes) return box(`${d.n}: ${a.prompt}`, h("div", { class: "opts" }, a.modes.map((t, k) => h("button", { class: "btn sm", onclick: () => { G.tpicks[a.idx] = [k]; G.ask = null; humanTrig(G.s, p); } }, t))));
    const need = Math.min(a.n, a.options.length); const show = Array.isArray(a.reveal) ? a.reveal : a.options;
    const okN = a.optional ? sel.length <= need : sel.length === need;
    if ((Arena.on || G.flat) && askOnTable(s)) { const done = (ids) => { G.tpicks[a.idx] = ids; G.ask = null; G.askSel = []; Arena.select(null); humanTrig(G.s, p); };
      return h("div", { class: "prompt glass slim low" }, h("b", null, `${d.n}: ${a.prompt}`), h("span", { class: "tiny muted" }, `${touchy() ? "แตะ" : "คลิก"}การ์ดที่เรืองแสงบนโต๊ะ หรือเลือกจากปุ่ม${show.some((i) => copyTag(s, i, show)) ? " (# = ใบที่เท่าไรนับจากซ้าย)" : ""}`),
        ...show.map((i) => { const L = E.locate(s, i); const can = a.options.includes(i); return pointAt(h("button", { class: "btn sm" + (sel.includes(i) ? " gold" : ""), disabled: !can, onclick: () => askToggle(i) }, `${L.p === p ? "" : "ฝ่ายตรงข้าม · "}${E.name(s, L.x)} ${copyTag(s, i, show)}P${E.power(s, L.x)}`), i); }),
        h("button", { class: "btn sm gold", disabled: !okN, onclick: () => done(G.askSel || []) }, sel.length ? "ยืนยัน" : a.optional ? "ยืนยัน (ไม่เลือก)" : "ยืนยัน"),
        a.optional && sel.length ? h("button", { class: "btn sm", onclick: () => done([]) }, "ไม่เลือก") : null); }
    return box(`${d.n}: ${a.prompt}`, h("div", { class: "tiny muted" }, Array.isArray(a.reveal) ? "การ์ดที่เปิดดู (ใบที่เลือกไม่ได้จะจางไว้)" : `เลือก ${need} ใบ${a.optional ? " หรือไม่เลือกก็ได้" : ""}`),
      h("div", { class: "pick" }, show.map((i) => { const L = E.locate(s, i); if (!L) return null; const dd = E.def(s, L.x); const can = a.options.includes(i);
        return pointAt(cardBtn(dd.im, { seat: L.x.o, info: () => cardView(L.x), cls: (sel.includes(i) ? "sel" : "") + (can ? "" : " dim"), badge: L.z === "av" || L.z === "cs" ? "P" + E.power(s, L.x) + " " + copyTag(s, i, show).trim() : ZONE_TH[L.z], note: !can && a.why ? a.why[i] : null, onclick: () => { if (!can) return cardView(L.x); askToggle(i); } }), i); })),
      show.some((i) => copyTag(s, i, show)) ? h("div", { class: "tiny muted" }, "ชื่อซ้ำกัน: เลข # คือใบที่เท่าไรนับจากซ้ายบนสนาม · แตะหรือชี้ตัวเลือก การ์ดใบนั้นบนโต๊ะจะเรืองแสง") : null,
      h("div", { class: "row" }, h("button", { class: "btn gold", disabled: !okN, onclick: () => { G.tpicks[a.idx] = G.askSel || []; G.ask = null; G.askSel = []; Arena.select(null); humanTrig(G.s, p); } }, "ยืนยัน"),
        a.optional ? h("button", { class: "btn", onclick: () => { G.tpicks[a.idx] = []; G.ask = null; G.askSel = []; Arena.select(null); humanTrig(G.s, p); } }, "ไม่เลือก") : null));
  }
  if (s.trig.length) { const t = s.trig[0];
    return box("กำลังทำงาน…", h("div", { class: "tiny muted" }, (s.cards[t.c] || {}).n || ""), G.stuck === t.id && t.seat === p ? trigEscape(s, t, p, "เอฟเฟกต์นี้ยังไม่จบ: ให้ระบบเลือกให้ หรือข้ามไปก็ได้") : null); }
  if (s.pend) {
    const moves = legalMoves(s, p); const reacts = P.hand.filter((x) => { const d = E.def(s, x); return d.t === "M" && d.st === "R" && !s.mu[p].R; });
    const att = E.locate(s, s.pend.att); const tgt = s.pend.tk === "life" ? "LIFE" : (E.locate(s, s.pend.ti) || { x: null }).x ? E.name(s, E.locate(s, s.pend.ti).x) : "?";
    const rs = E.reactsFor(s, p, { kind: "attack", by: s.pend.by, att: s.pend.att, tk: s.pend.tk, ti: s.pend.ti }); const held = heldReacts(s, p);
    const fc = fightForecast(s); const tN = fc && fc.T ? tagName(s, fc.T) : tgt; const lifeLeft = P.life.filter((l) => !l.up).length;
    const line = !fc ? "" : s.pend.tk === "life" ? `ตี LIFE ของคุณ (ยังคว่ำอยู่ ${lifeLeft} ใบ)` : fc.dead === "T" ? `ถ้าไม่ตอบโต้: ${tN} ของคุณจะถูกทำลาย` : fc.dead === "A" ? `ถ้าไม่ตอบโต้: ${tN} ของคุณชนะ (${tagName(s, fc.A)} ถูกทำลาย)` : fc.dead === "AT" ? `ถ้าไม่ตอบโต้: เสมอ ${tN} ของคุณกับ ${tagName(s, fc.A)} ถูกทำลายทั้งคู่` : "ถ้าไม่ตอบโต้: ไม่มีใครถูกทำลาย";
    { const key = [s.turn, s.pend.att, s.pend.tk, s.pend.ti].join(":"); if (G.annKey !== key && fc) { G.annKey = key; toast(`${s.P[s.pend.by].name}: ${tagName(s, fc.A)} (P${fc.ap}) ตี → ${s.pend.tk === "life" ? "LIFE ของคุณ" : `${tN} (P${fc.tp}) ของคุณ`}`); } }
    return boxLow(`ถูกโจมตี: ${fc ? tagName(s, fc.A) : "?"} (POWER ${fc ? fc.ap : 0}) ตี → ${s.pend.tk === "life" ? "LIFE ของคุณ" : `${tN} (POWER ${fc ? fc.tp : 0}) ของคุณ`}`,
      line ? h("div", { class: "small", style: `font-weight:700;color:${fc.dead === "T" || fc.dead === "AT" || s.pend.tk === "life" ? "var(--warn)" : "#8ee3b2"}` }, line) : null,
      !rs.length && moves.length <= 1 ? h("div", { class: "tiny muted" }, "ไม่มี โล่มนุษย์ ที่ตื่นอยู่ และไม่มี React ที่ใช้ได้ตอนนี้ · รับการโจมตีให้อัตโนมัติ") : null,
      held.later.length ? h("div", { class: "tiny", style: "color:#8ee3b2" }, `${held.later.join(", ")}: ยังไม่ใช่จังหวะตอนประกาศโจมตี ถ้า Avatar ของคุณกำลังจะถูกทำลายจากการต่อสู้นี้ เกมจะถามให้ใช้ก่อนถูกทำลาย`) : null,
      held.used.length ? h("div", { class: "tiny", style: "color:var(--warn)" }, `เทิร์นนี้คุณใช้ React ไปแล้ว 1 ใบ จึงใช้ ${held.used.join(", ")} ไม่ได้ (React ใช้ได้เทิร์นละ 1 ใบ)`) : null,
      rs.length ? h("div", { class: "opts" }, rs.map((x) => h("button", { class: "btn sm ciel", onclick: () => doAct({ type: "cast", i: x.i }, p) }, "React: " + E.name(s, x)))) : null,
      h("div", { class: "opts" }, moves.map((m) => h("button", { class: "btn sm" + (m.a.shield ? " gold" : ""), onclick: () => doAct(m.a, p) }, m.d))));
  }
  if (s.phase === "end" && s.need) {
    const n = (G.pick || []).length;
    return box(`มือเกิน 7 ใบ · ทิ้ง ${s.need} ใบ`, h("div", { class: "row" }, h("button", { class: "btn gold", disabled: n !== s.need, onclick: () => { const ids = G.pick; G.pick = null; doAct({ type: "discard", iids: ids }, p); } }, `ทิ้ง ${n}/${s.need}`)));
  }
  if (s.phase === "battle" && s.active === p) {
    const att = s.P[p].av.filter((x) => x.a); if (!att.length) return null; const O = s.P[1 - p];
    // on a computer the cards are clicked on the table (3D or flat), so the box is one slim row of names instead
    // of a panel of pictures over the middle of the table (the buttons stay, for the keyboard and for small cards)
    // (phones too: the Avatars on the table are tapped or dragged, so the big panel of pictures would only cover them)
    const slim = !!(Arena.on || G.flat);
    const pickAtt = (x) => { G.att = x.i; Arena.select(x.i); draw(); };
    // the bar stays one line so it never sits over the Avatars and their POWER; the list of names opens on request
    const listBtn = h("button", { class: "btn sm", onclick: () => { G.slimList = !G.slimList; draw(); } }, G.slimList ? "ซ่อนรายชื่อ" : "รายชื่อ");
    const attIds = att.map((x) => x.i);
    if (!G.att) return slim
      ? h("div", { class: "prompt glass slim" }, h("b", null, touchy() ? "แตะหรือลาก Avatar ที่เรืองแสง" : "ลาก Avatar ที่เรืองแสงไปที่เป้าหมาย หรือคลิก"), listBtn, ...(G.slimList ? att.map((x) => pointAt(h("button", { class: "btn sm", onclick: () => pickAtt(x) }, `${E.name(s, x)} ${copyTag(s, x.i, attIds)}P${E.power(s, x)}`), x.i)) : []))
      : box("เลือก Avatar ที่จะโจมตี", h("div", { class: "pick" }, att.map((x) => cardBtn(E.def(s, x).im, { seat: x.o, info: () => cardView(x), badge: "P" + E.power(s, x), onclick: () => pickAtt(x) }))));
    const a = E.locate(s, G.att); if (!a) { G.att = null; return null; }
    // what the fight would come to on the POWER showing now (LoR shows it before you commit): before any helper, React or ability
    const ap = E.power(s, a.x), fate = (y) => { const tp = E.power(s, y); if (ap !== tp) return ap > tp ? "ชนะ" : "แพ้"; const m = E.kw(s, a.x, "ลูกฮึด"), t2 = E.kw(s, y, "ลูกฮึด"); return m && !t2 ? "ชนะ (ลูกฮึด)" : t2 && !m ? "แพ้ (ลูกฮึด)" : "เสมอ"; };
    const opts = [...O.av.map((y) => ({ t: `${E.name(s, y)} (P${E.power(s, y)}) · ${fate(y)}`, tk: "av", ti: y.i, win: fate(y).startsWith("ชนะ") })), ...O.cs.map((y) => ({ t: `Construct ${E.name(s, y)} (P${E.power(s, y)}) · ${fate(y)}`, tk: "cs", ti: y.i, win: fate(y).startsWith("ชนะ") }))];
    const beat = opts.filter((o) => o.win).map((o) => o.t.split(" (P")[0]); const shield = O.av.some((y) => y.a && E.kw(s, y, "โล่มนุษย์"));
    const outlook = h("span", { class: "tiny muted" }, (beat.length ? `ตีชนะ: ${beat.slice(0, 3).join(", ")}${beat.length > 3 ? " …" : ""}` : "ยังไม่มีเป้าที่ตีชนะด้วย POWER ตอนนี้") + (shield ? " · ระวังโล่มนุษย์รับแทน" : ""));
    if ((E.lifeOpen(s, p, a.x) || E.kw(s, a.x, "เตะไข่")) && !E.noLife(s, a.x)) opts.push({ t: "LIFE ฝ่ายตรงข้าม (ตีบ้าน)", tk: "life" });
    const optBtns = opts.map((o) => h("button", { class: "btn sm" + (o.tk === "life" ? " gold" : ""), onclick: () => attack(G.att, o.tk, o.ti) }, o.t));
    if (slim) return h("div", { class: "prompt glass slim" }, h("b", null, `${E.name(s, a.x)} (P${E.power(s, a.x)}) โจมตี: ${touchy() ? "แตะ" : "คลิก"}เป้าบนโต๊ะ`), outlook, ...optBtns.filter((_, k) => opts[k].tk === "life" || G.slimList),
      h("button", { class: "btn sm", title: "Esc", onclick: closePicked }, "ยกเลิก"), listBtn);
    return box(`${E.name(s, a.x)} (P${E.power(s, a.x)}) โจมตี…`, outlook, h("div", { class: "opts" }, optBtns));
  }
  return null;
}
async function coach() {
  G.coachTurn = G.s.turn; G.coachLocal = !Ciel.on();
  if (!Ciel.on()) { G.coach = localHint(); return draw(); }
  G.coach = "ชิเอลกำลังดูกระดาน…"; draw();
  try { G.coach = (await cielCoach(G.s, view())).trim(); } catch (e) { G.coach = aiErr(e); }
  draw();
}
// "แนะนำ" without Ciel's key: what the pro bot would do for us from the table as it is now. Like the bot it sees only
// what a player sees (the other side's hand is guessed from the cards not yet shown), so it is a hint, not a cheat.
function localHint() {
  if (G.mode === "friend") return "คำแนะนำจากบอทใช้ได้ตอนเล่นกับบอทหรือซ้อมเท่านั้นค่ะ (ดวลกับเพื่อนต้องคิดเอง)";
  const s = G.s, p = whoActs(s); if (p == null || !mine(p) || s.phase === "over") return "ตอนนี้ไม่ใช่จังหวะของเราค่ะ";
  const P = s.P[p], nm = (i) => { const x = [...P.hand, ...P.av, ...P.cs].find((y) => y.i === i); return x ? E.name(s, x) : "?"; };
  const by = "คำแนะนำจากบอทมือโปร: ";
  try {
    if (s.phase === "toss") return "เลือกทอยเต๋าหรือโยนเหรียญได้เลยค่ะ โอกาสชนะเท่ากันทั้งสองวิธี ถ้าชนะจะได้เลือกว่าจะเริ่มก่อนหรือทีหลัง";
    if (s.phase === "mull") { const back = H.mulligan(s, p); return by + (back.length ? `เปลี่ยน ${back.map(nm).join(", ")}` : "เก็บมือนี้ไว้ (มี Avatar ราคาถูกพอเปิดเกม)"); }
    if (s.trig.length && !s.rw) return "จัดการเอฟเฟกต์ในกล่องกลางจอก่อนนะคะ";
    if (s.rw) { const r = H.react(s, p); return by + (r ? `ใช้ ${nm(r.i)} ตอบโต้` : "ไม่ต้องตอบโต้ตอนนี้"); }
    if (s.phase === "end" && s.need) return by + "ทิ้ง " + H.discard(s, p).map(nm).join(", ");
    if (s.pend) { const r = H.react(s, p); if (r) return by + `ใช้ React ${nm(r.i)}`; const m = H.pick(s, p); return by + (m ? m.d : "ปล่อยให้โจมตี"); }
    const look = H.look; H.look = BOT_LEVEL.hard.look; let m = null; try { m = H.mcPick(s, p, BOT_LEVEL.hard.mc); } finally { H.look = look; }
    return by + (m ? m.d : "จบเทิร์น");
  } catch (e) { console.warn(e); return "ตอนนี้คิดคำแนะนำไม่ออกค่ะ"; }
}
// tapping our Deck draws when drawing is a choice we may make right now: an effect asking whether to draw (its draw
// option is taken at once), or an ability of ours whose cost or effect is drawing (offered as buttons in the Deck sheet).
// The Draw Phase itself draws by the rules, with nothing to choose.
function deckDraws(s, P) {
  const p = s.P.indexOf(P), none = { pick: null, acts: [] };
  if (p < 0 || !mine(p) || G.replay || G.watch || s.phase === "over") return none;
  const a = G.ask; if (s.trig.length && a && a.modes && G.tk === s.trig[0].id && s.trig[0].seat === p) { const k = a.modes.findIndex((t) => /^จั่ว/.test(String(t))); return k >= 0 ? { pick: k, acts: [] } : none; }
  if (s.active !== p || s.trig.length || s.pend || s.rw || (s.phase !== "main" && s.phase !== "battle")) return none;
  const acts = legalMoves(s, p).filter((m) => { if (m.a.type !== "activate") return false; const L = E.locate(s, m.a.i); const lab = L ? m.d.replace(`สั่งใช้ ${E.name(s, L.x)}: `, "") : m.d; return /จั่ว/.test(lab); });
  return { pick: null, acts };
}
function openPile(P, z) {
  const s = G.s; const list = z === "deck" ? [] : P[z]; const live = G && G.s === s && !G.replay;
  const look = (x) => (live ? cardView(x) : showCard(E.def(s, x).im));
  if (z === "deck") {
    const dr = live ? deckDraws(s, P) : { pick: null, acts: [] };
    if (dr.pick != null) { const a = G.ask, p = s.trig[0].seat; G.tpicks[a.idx] = [dr.pick]; G.ask = null; toast(String(a.modes[dr.pick])); humanTrig(G.s, p); return; }
    // our own Deck: the cards still in it, one of each with how many are left, in a fixed order (by type and Cost),
    // never in the order they lie in; someone else's Deck: only how many are left
    const ours = !G.watch && (P === s.P[G.V] || (!!P.uid && P.uid === Me.uid && G.mode !== "friend"));
    const drawRow = dr.acts.length ? (api) => h("div", { class: "row wrap" }, dr.acts.map((m) => h("button", { class: "btn sm gold", onclick: () => { api.close(); doAct(m.a, s.P.indexOf(P)); } }, m.d)))
      : () => h("div", { class: "tiny muted" }, "Draw Phase จั่วให้เองตามกติกา · แตะ Deck จั่วได้เมื่อมีความสามารถหรือเอฟเฟกต์ให้เลือกจั่ว");
    return openSheet((api) => ours ? [live ? drawRow(api) : null, h("div", { class: "small muted" }, `เหลือ ${P.deck.length} ใบ · เรียงตามประเภทและ Cost ไม่ใช่ลำดับในกอง`), h("div", { class: "pick" }, deckLeft(s, P).map(({ x, n }) => cardBtn(E.def(s, x).im, { seat: x.o, badge: "×" + n, onclick: () => look(x) })))]
      : h("div", { class: "muted" }, `เหลือ ${P.deck.length} ใบ (การ์ดในกองของอีกฝ่ายดูไม่ได้)`), { title: `${ZONE_TH.deck} · ${P.name}`, wide: true });
  }
  openSheet(() => list.length ? h("div", { class: "pick" }, list.map((x) => cardBtn(E.def(s, x).im, { seat: x.o, onclick: () => look(x) }))) : h("div", { class: "empty" }, "ว่าง"), { title: `${ZONE_TH[z]} · ${P.name}`, wide: true });
}
const TYPE_ORD = { A: 0, T: 0, C: 1, M: 2 };
function deckLeft(s, P) {
  // one entry per card: printings of the same card (same name, type and POWER) count together
  const by = new Map(); for (const x of P.deck) { const d = E.def(s, x), k = `${d.t}|${d.n}|${d.pw || 0}`; const g = by.get(k); if (g) g.n++; else by.set(k, { x, n: 1 }); }
  const cost = (d) => (d.t === "M" ? d.g : d.c) ?? 0;
  return [...by.values()].sort((a, b) => { const da = E.def(s, a.x), db = E.def(s, b.x); return (TYPE_ORD[da.t] ?? 3) - (TYPE_ORD[db.t] ?? 3) || cost(da) - cost(db) || String(da.n).localeCompare(String(db.n), "th"); });
}
