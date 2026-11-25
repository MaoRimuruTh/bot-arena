// The site in English or Japanese: the pages are written in Thai, and a watcher swaps each piece of Thai text it knows
// (whole text nodes, and placeholder / title / aria-label) for the chosen language as it appears. Anything not in the
// lists below stays Thai, and the official card data (names, abilities) always does. Chosen per browser in Settings.
import { isOwnerNow } from "./persona.js?v=20261125121400";

export const LANGS = [["th", "ไทย"], ["en", "English"], ["ja", "日本語"]];
export const lang = () => { try { const v = localStorage.getItem("bot.lang"); return v === "en" || v === "ja" ? v : "th"; } catch { return "th"; } };
export const setLang = (v) => { try { if (v === "th") localStorage.removeItem("bot.lang"); else localStorage.setItem("bot.lang", v); } catch {} };

// [Thai, English, Japanese]
const WORDS = [
  // header
  ["สนาม", "Arena", "対戦"], ["เด็ค", "Decks", "デッキ"], ["คลังการ์ด", "Cards", "カード一覧"], ["ห้องทดลอง", "Lab", "ラボ"], ["ประวัติ", "History", "履歴"],
  ["ปลดล็อค", "Unlocks", "解放"], ["กฎ", "Rules", "ルール"], ["ถามชิเอล", "Ask Ciel", "シエルに質問"], ["เมนูหลัก", "Main menu", "メインメニュー"],
  ["เว็บนี้ต้องเปิด JavaScript", "This site needs JavaScript", "このサイトには JavaScript が必要です"],
  // the arena page
  ["สนามดวล", "Arena", "対戦"], ["เล่นตาม Rule Book 3.2 · ความสามารถของการ์ดทำงานให้อัตโนมัติ", "Played by Rule Book 3.2 · card abilities run by themselves", "ルールブック 3.2 準拠 · カードの能力は自動で処理されます"],
  ["เด็คของคุณ", "Your deck", "あなたのデッキ"], ["ดูเด็ค", "View deck", "デッキを見る"], ["ชิเอลจัดให้", "Built by Ciel", "シエル構築"], ["เด็คกล่อง", "Box decks", "ボックスデッキ"],
  ["Starter Deck ทางการ", "Official Starter Decks", "公式スターターデッキ"], ["เลือกเด็คของคุณ", "Choose your deck", "デッキを選ぶ"], ["เลือกเด็คของอีกฝั่ง", "Choose the other side's deck", "相手のデッキを選ぶ"],
  ["ภารกิจวันนี้", "Today's quests", "今日のミッション"], ["ชนะเกมที่เราได้เล่นทีหลัง", "Win a game where you go second", "後攻で勝つ"], ["ดวลกับเพื่อนจนจบ 1 เกม", "Finish 1 game against a friend", "フレンドと 1 ゲーム最後まで対戦"],
  ["ไขโจทย์ปริศนาสำเร็จ 1 ข้อ", "Solve 1 puzzle", "パズルを 1 問解く"],
  ["ดวลกับบอท", "Play the bot", "ボット対戦"], ["ซ้อมมือกับชิเอล", "Practise against Ciel", "シエルと練習"], ["ดวลกับเพื่อน", "Play a friend", "フレンド対戦"], ["ออนไลน์ผ่านห้อง", "Online, through a room", "ルームでオンライン"],
  ["เล่นสองฝั่ง", "Play both sides", "両側を操作"], ["ทดลองคอมโบเอง", "Try combos yourself", "自分でコンボを試す"], ["สนามซ้อม", "Sandbox", "練習盤面"], ["จัดสนามเองแล้วลองเล่น", "Set up a board and play it", "盤面を作って試す"],
  ["ซ้อมมือเดียว", "Solo practice", "一人回し"], ["วัดว่าเด็คชนะเร็วแค่ไหน", "How fast does the deck win?", "デッキの勝つ速さを測る"], ["โจทย์ปริศนา", "Puzzles", "詰めパズル"], ["หาทางชนะในเทิร์นเดียว", "Find the win in one turn", "1 ターンで勝つ道を探す"],
  ["กติกาสัปดาห์", "Weekly rule", "今週のルール"], ["มือเปิดอิ่ม", "Full opening hand", "初手充実"], ["ไต่ด่าน", "Gauntlet", "連戦モード"], ["เอาชนะเด็คทางการทีละด่าน", "Beat the official decks one by one", "公式デッキを順に倒す"],
  ["สอนเล่น", "Tutorial", "チュートリアル"], ["เรียนกติกาทีละขั้น", "Learn the rules step by step", "ルールを一歩ずつ学ぶ"], ["เด็คของบอท", "Bot's deck", "ボットのデッキ"], ["สุ่ม", "Random", "ランダム"],
  ["สุ่ม Starter", "Random Starter", "ランダム スターター"], ["สุ่มจาก Starter Deck", "Random Starter Deck", "スターターデッキからランダム"], ["สมองบอท", "Bot level", "ボットの強さ"], ["ง่าย", "Easy", "やさしい"], ["ปกติ", "Normal", "ふつう"],
  ["เก่ง", "Strong", "つよい"], ["โปร+", "Pro+", "プロ+"], ["ชิเอล", "Ciel", "シエル"], ["เริ่มดวล", "Start", "対戦開始"], ["เล่นต่อ", "Continue", "続きから"],
  ["บอทระดับปกติ คิดล่วงหน้าหนึ่งจังหวะ ข้ามเอฟเฟกต์ข้อความของตัวเอง", "Normal bot: looks one move ahead and skips its own text effects", "ふつうのボット：一手先を読み、自分のテキスト効果は使いません"],
  ["สร้างห้อง", "Create room", "ルーム作成"], ["ห้องที่รออยู่", "Open rooms", "待機中のルーム"], ["กำลังเล่นอยู่", "Playing now", "対戦中"], ["ตอนนี้ยังไม่มีใครเล่นอยู่", "Nobody is playing right now", "今は誰も対戦していません"],
  ["บอท", "Bot", "ボット"],
  // the table
  ["เทิร์น", "Turn", "ターン"], ["ตาของคุณ", "Your turn", "あなたの番"], ["ตาคู่แข่ง", "Their turn", "相手の番"], ["แนะนำ", "Hint", "ヒント"], ["เมนู", "Menu", "メニュー"], ["นรกคู่แข่ง", "Foe hell", "相手地獄"],
  ["เสียง", "Sound", "サウンド"], ["แคป", "Snap", "撮影"], ["นรก", "Hell", "地獄"], ["มิติมืด", "Dark zone", "暗黒次元"], ["← ออก", "← Leave", "← 退出"],
  ["เสี่ยงทายว่าใครได้เลือกเริ่มก่อนหรือทีหลัง", "Toss to see who chooses to go first or second", "先攻・後攻を選ぶ権利を決めます"],
  ["ก่อนเริ่มเกม: เลือกทอยเต๋าหรือโยนเหรียญ ผู้ชนะได้เลือกว่าจะเริ่มก่อนหรือทีหลัง", "Before the game: roll a die or toss a coin; the winner chooses to go first or second", "開始前：サイコロかコインを選び、勝った方が先攻・後攻を選びます"],
  ["ใครได้เลือกเริ่มก่อน?", "Who chooses who goes first?", "先攻・後攻を選ぶのは？"],
  ["เลือกวิธีเสี่ยงทาย ผู้ชนะได้เลือกว่าจะเริ่มก่อนหรือทีหลัง · ถ้าเลือกไม่ตรงกัน ระบบสุ่มหนึ่งในสองวิธีให้", "Pick how to toss; the winner chooses first or second · if you pick differently, one of the two is drawn at random", "方法を選んでください。勝った方が先攻・後攻を選びます · 選択が違う場合はどちらかを抽選します"],
  ["ทอยเต๋า", "Roll a die", "サイコロ"], ["ทอยคนละลูก แต้มมากกว่าได้เลือก", "One die each; the higher roll chooses", "1 個ずつ振り、大きい方が選びます"], ["โยนเหรียญ", "Toss a coin", "コイントス"],
  ["เหรียญสองหน้าเป็นรูปของทั้งสองฝ่าย หน้าใครออก คนนั้นได้เลือก", "Each face shows one player; whoever comes up chooses", "表裏に両者の絵。出た方が選びます"],
  ["หมุนมือถือเป็นแนวตั้ง", "Turn your phone upright", "スマホを縦にしてください"], ["สนามบนมือถือจัดไว้สำหรับแนวตั้ง การ์ดจะใหญ่และกดง่ายกว่า", "The phone table is laid out upright: cards are bigger and easier to tap", "スマホの盤面は縦向き用です。カードが大きく押しやすくなります"],
  ["เล่นแนวนอนต่อ", "Keep playing sideways", "横向きのまま続ける"], ["หมุนมือถือ", "Rotate phone", "スマホを回転"],
  ["ดู LIFE ที่หงายแล้ว", "See face-up LIFE", "表向きのライフを見る"], ["สถานะเทิร์น", "Turn status", "ターンの状況"], ["เฟสของเทิร์น", "Turn phases", "ターンのフェイズ"], ["ส่งอีโมต", "Send an emote", "エモートを送る"],
  ["ชิเอลแนะนำ", "Ciel's hint", "シエルのヒント"], ["เมนูเกม: กองการ์ด ย้อนตา แจ้งปัญหา ยอมแพ้", "Game menu: piles, take back, report, concede", "ゲームメニュー：カードの山・待った・報告・投了"],
  ["ดูนรกของคู่แข่ง", "See their hell", "相手の地獄を見る"], ["ถามชิเอลเกี่ยวกับตานี้", "Ask Ciel about this turn", "この番についてシエルに質問"], ["เสียงเอฟเฟกต์และเพลง", "Sound effects and music", "効果音と音楽"],
  ["แคปภาพโต๊ะ (ไม่ติดไพ่บนมือ)", "Capture the table (hand hidden)", "盤面を撮影（手札は写りません）"], ["บันทึกเกม", "Game log", "ゲームログ"], ["การ์ดบนมือ", "Cards in hand", "手札"],
  ["ยอมแพ้", "Concede", "投了"], ["ย้อนตา", "Take back", "待った"], ["แจ้งปัญหา", "Report a problem", "問題を報告"], ["จบเทิร์น", "End turn", "ターン終了"], ["เข้าสู่ Battle Phase", "Go to Battle Phase", "バトルフェイズへ"],
  ["ใช้เลย", "Use it", "使う"], ["ไม่ใช้", "Don't use", "使わない"], ["ไม่ตอบโต้", "No response", "対応しない"], ["ตกลง", "OK", "OK"], ["เริ่มก่อน", "Go first", "先攻"], ["เริ่มทีหลัง", "Go second", "後攻"],
  ["เก็บมือเดิม", "Keep hand", "手札をキープ"], ["เปลี่ยนมือ", "Mulligan", "マリガン"], ["ชนะ!", "Victory!", "勝利！"], ["แพ้", "Defeat", "敗北"], ["เล่นอีกครั้ง", "Play again", "もう一度"],
  // playing a game
  ["ยืนยัน", "Confirm", "確定"], ["สั่งใช้", "Activate", "起動"], ["อัญเชิญ", "Summon", "召喚"], ["ก่อสร้าง", "Build", "建設"], ["ใช้", "Use", "使用"], ["ใช้การ์ด", "Play card", "カードを使う"],
  ["อัญเชิญ Avatar", "Summon Avatar", "アバター召喚"], ["ใช้ Magic", "Play Magic", "マジックを使う"], ["ใช้ React", "Play React", "リアクトを使う"], ["ใช้ React ตอบโต้!", "React!", "リアクトで対応！"],
  ["ไป Battle Phase", "Go to Battle Phase", "バトルフェイズへ"], ["ไป Battle", "To Battle", "バトルへ"], ["จบเทิร์นเลย", "End turn now", "すぐにターン終了"], ["ยกเลิกการเลือก", "Clear selection", "選択を解除"],
  ["ยืนยันทั้งหมด", "Confirm all", "すべて確定"], ["ย้อนกลับ", "Back", "戻る"], ["ความสามารถ", "Ability", "能力"], ["ไม่เลือก", "Choose none", "選ばない"], ["ให้ระบบเลือกให้", "Let the game choose", "自動で選ぶ"],
  ["ข้ามเอฟเฟกต์", "Skip effect", "効果をスキップ"], ["ทำไม่ได้", "Can't do that", "できません"], ["ตีเลย", "Attack", "攻撃する"], ["ยืนยันการโจมตี", "Confirm attack", "攻撃を確定"], ["ยืนยันการใช้การ์ด", "Confirm card", "カード使用を確定"],
  ["ทิ้งแล้วใช้การ์ด", "Discard and play", "捨てて使う"], ["ทิ้งการ์ดเป็นค่าใช้", "Discard as the cost", "コストとして捨てる"], ["ใช้จริงไหม / ตีจริงไหม", "Play it? / Attack?", "本当に使う？／攻撃する？"],
  ["ออกจากสนาม", "Leaves the field", "場を離れる"], ["นอน", "Rested", "レスト"], ["ตื่น", "Awake", "スタンド"], ["ลูกฮึด", "Last Stand", "粘り"], ["เตะไข่", "Low Blow", "急所蹴り"],
  ["จุติ", "On summon", "降臨時"], ["คำสั่งเสีย", "Last words", "遺言"], ["เมื่อโจมตี", "When attacking", "攻撃時"], ["เมื่อถูกโจมตี", "When attacked", "被攻撃時"], ["เมื่อชนะการต่อสู้", "When it wins a fight", "戦闘勝利時"],
  ["ต้น Main Phase", "Start of Main Phase", "メインフェイズ開始時"], ["เอฟเฟกต์", "Effect", "効果"], ["การ์ด", "Card", "カード"], ["คุณ", "You", "あなた"], ["เรา", "Us", "自分"], ["เพื่อน", "Friend", "フレンド"],
  ["ชนะ", "Win", "勝ち"], ["เสมอ", "Draw", "引き分け"], ["จบเกม", "Game over", "ゲーム終了"], ["ดวลอีกครั้ง", "Rematch", "再戦"], ["เล่นอีก", "Play again", "もう一度"], ["ออก", "Leave", "退出"],
  ["สลับฝั่ง", "Switch sides", "視点切替"], ["หุ่นซ้อม", "Practice dummy", "練習人形"], ["คำใบ้", "Hint", "ヒント"], ["↶ ย้อนตา", "↶ Take back", "↶ 待った"], ["เลิกดู", "Stop watching", "観戦をやめる"],
  ["🔊 เสียงและเพลง", "🔊 Sound and music", "🔊 サウンドと音楽"], ["🔇 เสียงและเพลง", "🔇 Sound and music", "🔇 サウンドと音楽"], ["กลับหน้าเตรียมเกม", "Back to setup", "準備画面へ戻る"],
  ["สรุปเกม", "Game summary", "ゲームまとめ"], ["คุณชนะ!", "You win!", "あなたの勝ち！"], ["เกมเสมอ", "Draw game", "引き分け"], ["เกมจบแล้ว", "The game is over", "ゲームは終了しました"], ["เกมนี้จบแล้ว", "This game is over", "このゲームは終了しました"],
  ["ถึงตาคุณแล้ว", "Your turn", "あなたの番です"], ["เสี่ยงทายว่าใครได้เลือกเริ่มก่อน", "Toss for who chooses to go first", "先攻・後攻を選ぶ権利を決めます"], ["เลือกเปลี่ยนการ์ดบนมือ", "Choose cards to swap", "交換するカードを選ぶ"],
  ["มีเอฟเฟกต์ให้เลือก", "An effect needs a choice", "効果の選択があります"], ["เลือกการ์ดที่จะเปลี่ยน หรือเก็บมือเดิม", "Pick cards to swap, or keep your hand", "交換するカードを選ぶか、手札をキープ"],
  ["มีเอฟเฟกต์ต้องจัดการ", "An effect is waiting", "処理する効果があります"], ["ใช้ React ตอบโต้ หรือกด ไม่ตอบโต้", "Play a React, or press No response", "リアクトを使うか「対応しない」を押す"],
  ["ถูกโจมตี เลือกการตอบโต้", "You are attacked: choose a response", "攻撃されました。対応を選んでください"], ["Main Phase · แตะการ์ดบนมือเพื่อเล่น", "Main Phase · tap a card in hand to play it", "メインフェイズ · 手札をタップして使う"],
  ["คลิกเป้าหมาย หรือลากไปปล่อยที่เป้า", "Click a target, or drag onto it", "対象をクリックするか、ドラッグして離す"], ["เมนูเกม (มีความสามารถที่สั่งใช้ได้)", "Game menu (abilities ready to activate)", "ゲームメニュー（起動できる能力あり）"],
  ["เมนูเกม", "Game menu", "ゲームメニュー"], ["เลือกการ์ดที่จะเปลี่ยน", "Pick the cards to swap", "交換するカードを選ぶ"], ["จัดการเอฟเฟกต์ในกล่องกลางจอ", "Resolve the effect in the box", "中央の枠で効果を処理してください"],
  ["เลือกการตอบโต้ในกล่องกลางจอ", "Choose a response in the box", "中央の枠で対応を選んでください"], ["สาหัส! ถูกตี LIFE อีกครั้งจะแพ้", "Critical! One more LIFE hit and you lose", "瀕死！ もう一度ライフに攻撃を受けると負け"],
  ["เกมนี้ไม่นับผล", "This game does not count", "このゲームは記録されません"], ["สลับไปดูจากอีกฝั่ง", "View from the other side", "反対側から見る"], ["นรกอีกฝั่ง", "Other side's hell", "相手側の地獄"],
  ["นรกเรา", "Our hell", "自分の地獄"], ["มิติมืดเรา", "Our dark zone", "自分の暗黒次元"], ["สั่งใช้ได้ตอนนี้", "Can activate now", "今起動できる"], ["ตี LIFE ฝ่ายตรงข้าม (ตีบ้าน)", "Attack their LIFE", "相手のライフを攻撃"],
  ["LIFE ฝ่ายตรงข้าม", "Their LIFE", "相手のライフ"], ["LIFE ของคุณ", "Your LIFE", "あなたのライフ"], ["ยังไม่มี LIFE ที่หงาย", "No face-up LIFE yet", "表向きのライフはまだありません"], ["แตะการ์ดเพื่ออ่านความสามารถ", "Tap a card to read its ability", "カードをタップして能力を読む"],
  ["✉ ถามชิเอล (แนบสถานะเกม)", "✉ Ask Ciel (with the game state)", "✉ シエルに質問（状況を添付）"], ["📷 แคปภาพโต๊ะ", "📷 Capture the table", "📷 盤面を撮影"], ["📖 คำศัพท์", "📖 Glossary", "📖 用語集"],
  ["ชิเอลกำลังคิด…", "Ciel is thinking…", "シエルが考え中…"], ["บอทโปร+ กำลังคิด…", "Pro+ bot is thinking…", "プロ+ボットが思考中…"], ["เห็นทางชนะในเทิร์นนี้แล้ว!", "There is a win this turn!", "このターンに勝ち筋があります！"],
  ["ภารกิจวันนี้สำเร็จ", "Today's quest done", "今日のミッション達成"], ["ปลดล็อคความสำเร็จ", "Achievement unlocked", "実績解除"], ["ยอมแพ้?", "Concede?", "投了しますか？"],
  ["ขอชนะเกมนี้เพราะคู่แข่งไม่อยู่?", "Claim the win because your opponent is away?", "相手不在で勝利を申請しますか？"], ["ขอชนะ", "Claim the win", "勝利を申請"], ["ขอชนะเกมนี้", "Claim this game", "このゲームの勝利を申請"],
  ["กำลังชม", "Watching", "観戦中"], ["มือเกิน 7 ใบ", "More than 7 cards in hand", "手札が 7 枚を超えています"], ["แตะการ์ดบนมือที่จะทิ้ง", "Tap the cards to discard", "捨てるカードをタップ"], ["สถานะสาหัส", "Critical", "瀕死状態"],
  ["เข้าใจแล้ว", "Got it", "わかった"], ["ปิดคำอธิบาย", "Close the guide", "説明を閉じる"], ["ความดัง", "Volume", "音量"], ["สวัสดี 👋", "Hello 👋", "こんにちは 👋"], ["ขอให้สนุกนะ", "Have fun!", "楽しもう！"],
  ["ว้าว!", "Wow!", "わお！"], ["เก่งมาก!", "Well played!", "うまい！"], ["อุ๊ย!", "Oops!", "おっと！"], ["ขอคิดแป๊บ 🤔", "Let me think 🤔", "ちょっと考えさせて 🤔"], ["ขอบคุณนะ", "Thanks!", "ありがとう"], ["GG เกมดี!", "GG, good game!", "GG！"],
  ["ชอบมาก ❤", "Love it ❤", "最高 ❤"], ["ไม่ยอมนะ! 💢", "Not giving up! 💢", "負けないよ！ 💢"], ["งอนแล้วนะ 😤", "Hmph 😤", "むっ 😤"], ["ฮือ… 😭", "Waah… 😭", "うぅ… 😭"], ["รอแป๊บค่อยส่งอีกนะ", "Wait a moment before the next one", "少し待ってから送ってね"],
  ["ไม่แสดงอีโมตของคู่แข่ง", "Hide the opponent's emotes", "相手のエモートを表示しない"], ["คู่แข่งเพิ่งเล่น", "Opponent just played", "相手が使ったカード"], ["บอทมือใหม่", "Beginner bot", "初心者ボット"], ["บอทมือโปร", "Pro bot", "プロボット"], ["บอทโปร+ (คิดลึก)", "Pro+ bot (deep)", "プロ+ボット（深読み）"],
  ["เป้าหมายที่ 2", "Second target", "2 つ目の対象"], ["ชิเอลอ่านเอฟเฟกต์ให้", "Ciel read the effect", "シエルが効果を読みました"], ["ไม่มีข้อความความสามารถ", "No ability text", "能力テキストなし"], ["ตอน Avatar ของคุณถูกทำลาย", "When your Avatar is destroyed", "あなたのアバターが破壊された時"],
  ["รอเพื่อน…", "Waiting for your friend…", "フレンドを待っています…"], ["พร้อมเริ่มใหม่", "Ready to restart", "再開の準備 OK"], ["เพื่อนขอดวลอีกครั้ง", "Your friend wants a rematch", "フレンドが再戦を希望しています"], ["จบเกมแบบไม่มีผล", "End as no contest", "無効試合で終了"],
  ["ไม่นับผล", "No contest", "無効試合"], ["ดูรีเพลย์", "Watch replay", "リプレイを見る"], ["วิเคราะห์เกมนี้", "Analyse this game", "この対戦を分析"], ["ดูกระดาน", "See the board", "盤面を見る"], ["แชร์รีเพลย์", "Share replay", "リプレイを共有"],
  ["คัดลอกลิงก์", "Copy link", "リンクをコピー"], ["คัดลอกลิงก์แล้ว", "Link copied", "リンクをコピーしました"], ["ภาพโต๊ะตอนนี้", "The table now", "現在の盤面"], ["บันทึกรูป", "Save picture", "画像を保存"], ["แชร์", "Share", "共有"],
  ["ไม่ติดไพ่บนมือของเรา", "Your hand is not in the picture", "手札は写りません"], ["หยุด", "Pause", "一時停止"], ["เล่น", "Play", "再生"], ["ความเร็ว", "Speed", "速度"], ["ไปที่เทิร์น", "Go to turn", "ターンへ移動"],
  ["กลับไปเริ่มเกม", "Back to the start", "最初に戻る"], ["ย้อนไปเทิร์นก่อนหน้า", "Previous turn", "前のターン"], ["ย้อนหนึ่งจังหวะ", "Step back", "1 手戻る"], ["ไปข้างหน้าหนึ่งจังหวะ", "Step forward", "1 手進む"], ["ไปเทิร์นถัดไป", "Next turn", "次のターン"],
  ["ยังไม่มีอะไรให้ย้อน", "Nothing to take back yet", "まだ戻せる手はありません"], ["ย้อนแล้ว", "Taken back", "戻しました"], ["เลือกเด็คก่อน", "Choose a deck first", "先にデッキを選んでください"], ["ยังไม่ได้เลือกเด็ค", "No deck chosen", "デッキ未選択"],
  ["เด็คของฉัน", "My decks", "マイデッキ"], ["ของเพื่อน", "Friends'", "フレンドの"], ["Starter Deck แบบสุ่ม", "Random Starter Deck", "ランダムなスターターデッキ"], ["เริ่มดวลกติกาพิเศษ", "Start with the special rule", "特別ルールで開始"], ["เริ่มสอนเล่น", "Start the tutorial", "チュートリアル開始"],
  ["ท้าดวล", "Challenge", "挑戦"], ["ยังไม่ถึง", "Not yet", "まだ"], ["ผ่านครบทุกด่านแล้ว", "Every stage cleared", "全ステージクリア"], ["เริ่มซ้อม", "Start practice", "練習開始"], ["เริ่ม", "Start", "開始"], ["เริ่มเกม", "Start game", "ゲーム開始"],
  ["เปิดสนามซ้อม", "Open the sandbox", "練習盤面を開く"], ["กำลังหาห้อง…", "Looking for rooms…", "ルームを探しています…"], ["มีห้องรอดวล", "A room is waiting", "待機中のルームがあります"], ["เพื่อนเข้าแล้ว เริ่มเกม", "Your friend joined: start", "フレンド参加。開始"],
  ["กลับเข้าห้อง", "Back to the room", "ルームに戻る"], ["ยกเลิกห้อง", "Cancel room", "ルームを取り消す"], ["เข้าร่วม", "Join", "参加"], ["ยังไม่มีห้องที่รออยู่", "No open rooms yet", "待機中のルームはありません"], ["กลับเข้าเกม", "Back to the game", "ゲームに戻る"], ["ดู", "Watch", "観戦"],
  ["จัดทัวร์นาเมนต์ในกลุ่มเพื่อน", "Run a tournament for friends", "フレンド大会を開く"], ["นาฬิกา", "Clock", "持ち時間"], ["ซีรีส์ชนะ 2 ใน 3", "Best of 3", "3 本勝負"], ["แมตช์ทัวร์", "Tournament match", "大会の試合"],
  ["มีเวอร์ชันใหม่", "A new version is out", "新しいバージョンがあります"], ["โหลดเวอร์ชันใหม่", "Load the new version", "新バージョンを読み込む"], ["ไว้ก่อน", "Later", "あとで"], ["รีโหลดแล้วเล่นต่อ", "Reload and continue", "再読み込みして続ける"],
  ["ตกลง เริ่มใหม่", "OK, restart", "OK、やり直す"], ["ไม่ล่ะ", "No thanks", "やめておく"], ["เหมือนเดิม", "Same as before", "前と同じ"], ["ไม่เล่นต่อ", "Stop here", "ここでやめる"], ["เพื่อนเข้าห้องแล้ว", "Your friend joined", "フレンドが参加しました"],
  ["ยินดีต้อนรับสู่สนามดวล", "Welcome to the arena", "対戦へようこそ"], ["ตัวช่วยระหว่างเล่น", "Help while you play", "プレイ中のヘルプ"], ["ชี้หรือแตะการ์ดเพื่อดูรายละเอียดเต็ม", "Point at or tap a card to see it in full", "カードを指すかタップすると詳細を表示"],
  // decks, the card library, the lab, unlocks
  ["จัดเด็คก่อนซื้อจริง ลองเล่น แล้วดูว่าต้องซื้อการ์ดอะไรเพิ่ม", "Build a deck before you buy, play it, then see which cards you still need", "買う前にデッキを組んで試し、足りないカードを確認"],
  ["♥ จัดเด็คจากการ์ดที่ชอบ", "♥ Build from favourite cards", "♥ お気に入りから組む"], ["ให้ชิเอลจัดรอบการ์ดเอซ", "Let Ciel build around an ace", "エースを軸にシエルが構築"], ["นำเข้าเด็ค", "Import deck", "デッキを読み込む"], ["สร้างเด็คใหม่", "New deck", "新しいデッキ"],
  ["ยังไม่มีเด็คของคุณ เริ่มจากเลือกการ์ดเอซให้ชิเอลจัด หรือคัดลอก Starter Deck ด้านล่างไปแก้ต่อ", "No decks of yours yet. Pick an ace for Ciel to build around, or copy a Starter Deck below and edit it", "まだデッキがありません。エースを選んでシエルに組ませるか、下のスターターデッキをコピーして編集しましょう"],
  ["✦ เด็คแนะนำจากชิเอล", "✦ Ciel's recommended decks", "✦ シエルのおすすめデッキ"], ["เด็คธีมที่ชิเอลจัดให้ริมุรุ เปิดดูแผนการเล่น ลงสนามได้เลย หรือคัดลอกไปแก้ต่อ", "Theme decks Ciel built for Rimuru: read the game plan, play them, or copy one to edit", "シエルがリムルのために組んだテーマデッキ。プランを読む・対戦・コピーして編集"],
  ["✦ ชิเอลแนะนำ", "✦ Ciel's pick", "✦ シエルのおすすめ"], ["พร้อมเล่น", "Ready to play", "使用可能"], ["ผิดกติกา", "Not legal", "ルール違反"], ["ทางการ", "Official", "公式"], ["แข่งจริงไม่ได้", "Not tournament legal", "公式大会では使用不可"],
  ["จัดตามจำนวนในกล่องจริงจากรายการการ์ดทางการ", "Counts as in the real box, from the official card list", "公式カードリストどおりの実物の枚数"], ["คัดสรรเด็ค กล่องพิเศษ", "Kudsan Deck special boxes", "特別ボックス「คัดสรรเด็ค」"], ["คัดสรรเด็ค", "Kudsan Deck", "คัดสรรเด็ค"],
  ["เด็คกล่องพิเศษทางการ กล่องที่เล่นแรงกว่า Starter Deck มากจะล็อคไว้ เปิดได้ด้วยการชนะตามเงื่อนไขเท่านั้น ไม่มีการซื้อปลดล็อค", "Official special box decks. The ones far stronger than the Starter Decks are locked and open only by winning as shown; nothing can be bought", "公式の特別ボックスデッキ。スターターより大幅に強いものはロックされ、条件どおり勝つことでのみ解放されます（購入はありません）"],
  ["ล็อคอยู่", "Locked", "ロック中"],
  ["ข้อมูลและภาพโหลดสดจากเว็บทางการ bottcg.com · ภาพ © PASULOL / LION HOUSE", "Data and pictures load live from the official bottcg.com · art © PASULOL / LION HOUSE", "データと画像は公式 bottcg.com から直接読み込み · 画像 © PASULOL / LION HOUSE"],
  ["ทุกประเภท", "All types", "すべての種類"], ["ทุกสี", "All colours", "すべての色"], ["สีแดง", "Red", "赤"], ["สีฟ้า", "Blue", "青"], ["สีเขียว", "Green", "緑"], ["สีม่วง", "Purple", "紫"], ["ไร้สี", "Colourless", "無色"],
  ["ทุก Cost", "Any Cost", "すべてのコスト"], ["ทุก Symbol", "Any Symbol", "すべてのシンボル"], ["ทุกชุด", "All sets", "すべてのセット"], ["ทุกความหายาก", "All rarities", "すべてのレアリティ"], ["รวมภาพพิเศษ", "Include alt art", "特別イラストを含む"],
  ["✦ เฉพาะภาพพิเศษ", "✦ Alt art only", "✦ 特別イラストのみ"], ["♥ ที่ชอบ", "♥ Favourites", "♥ お気に入り"], ["เฉพาะที่มี", "Owned only", "所持のみ"], ["ค้นชื่อ ข้อความ รหัส หรือ Symbol", "Search name, text, code or Symbol", "名前・テキスト・番号・シンボルで検索"],
  ["ค้นหา", "Search", "検索"], ["ประเภท", "Type", "種類"], ["สี", "Colour", "色"], ["ชุด", "Set", "セット"], ["ความหายาก", "Rarity", "レアリティ"],
  ["กะปอม", "Lizard · กะปอม", "トカゲ · กะปอม"], ["คน", "Human · คน", "人間 · คน"], ["จอมเวทย์", "Mage · จอมเวทย์", "魔法使い · จอมเวทย์"], ["ไซเบอร์", "Cyber · ไซเบอร์", "サイバー · ไซเบอร์"], ["ต้นไม้", "Tree · ต้นไม้", "樹木 · ต้นไม้"],
  ["ต่างชาติ", "Foreigner · ต่างชาติ", "外国人 · ต่างชาติ"], ["ทหาร", "Soldier · ทหาร", "兵士 · ทหาร"], ["เทพ", "God · เทพ", "神 · เทพ"], ["ปลา", "Fish · ปลา", "魚 · ปลา"], ["เปรต", "Preta · เปรต", "餓鬼 · เปรต"], ["ผี", "Ghost · ผี", "幽霊 · ผี"],
  ["มังกร", "Dragon · มังกร", "竜 · มังกร"], ["แมลง", "Insect · แมลง", "虫 · แมลง"], ["ยักษ์", "Giant · ยักษ์", "夜叉 · ยักษ์"], ["ฤษี", "Hermit · ฤษี", "仙人 · ฤษี"], ["สัตว์", "Animal · สัตว์", "動物 · สัตว์"], ["สัตว์วิเศษ", "Mythical beast · สัตว์วิเศษ", "幻獣 · สัตว์วิเศษ"],
  ["สิ่งก่อสร้าง", "Structure · สิ่งก่อสร้าง", "建造物 · สิ่งก่อสร้าง"], ["หุ่นยนต์", "Robot · หุ่นยนต์", "ロボット · หุ่นยนต์"], ["เอเลี่ยน", "Alien · เอเลี่ยน", "エイリアン · เอเลี่ยน"],
  ["ลองมือเปิด ดูโอกาสจั่ว และจำลองเกมก่อนลงสนามจริง", "Try opening hands, see draw odds and simulate games before you play", "初手を試し、ドロー確率を見て、実戦前に対戦をシミュレート"], ["สุ่มใหม่", "Draw again", "引き直す"],
  ["บอทจะเปลี่ยนมือนี้", "The bot would mulligan this", "ボットはこれをマリガンします"], ["ตารางพบกันและคู่มือเปลี่ยนมือ", "Matchups and mulligan guide", "相性表とマリガンガイド"], ["ตารางพบกัน", "Matchups", "相性表"], ["คู่มือเปลี่ยนมือของเด็คนี้", "This deck's mulligan guide", "このデッキのマリガンガイド"],
  ["เด็คไหนชนะเด็คไหน (แยกเล่นก่อน/หลัง) และมือเปิดแบบไหนควรเก็บหรือเปลี่ยน จากบอทเล่นกันเองหลายพันเกม", "Which deck beats which (going first / second) and which opening hands to keep or swap, from thousands of bot games", "どのデッキがどれに勝つか（先攻/後攻別）と、残すべき初手・替えるべき初手。ボット同士の数千戦より"],
  ["โอกาสได้การ์ด (เล่นก่อน ไม่นับเปลี่ยนมือ)", "Chance to draw (going first, no mulligan)", "ドロー確率（先攻・マリガンなし）"], ["ภายในเทิร์น 3", "By turn 3", "3 ターン目まで"], ["มือเปิด", "Opening hand", "初手"],
  ["จำลองบอทชนบอท", "Bot vs bot simulation", "ボット同士のシミュレーション"], ["ชน", "vs", "対"], ["หุ่นซ้อม (ไม่เล่นอะไรเลย)", "Practice dummy (does nothing)", "練習人形（何もしない）"], ["บอทปกติ (เร็ว)", "Normal bot (fast)", "ふつうのボット（速い）"],
  ["บอทมือโปร (ช้ากว่า เล่นเก่งกว่า)", "Pro bot (slower, stronger)", "プロボット（遅いが強い）"], ["เริ่มจำลอง", "Run simulation", "シミュレーション開始"], ["เด็คที่ทดสอบ", "Deck tested", "テストするデッキ"], ["เด็คคู่แข่ง", "Opponent deck", "相手のデッキ"],
  ["จำนวนเกม", "Games", "試合数"], ["บอทที่เล่นทั้งสองฝั่ง", "Bot for both sides", "両側のボット"],
  ["ของทุกชิ้นในหน้านี้ได้จากการเล่นเท่านั้น ไม่มีการซื้อหรือเติมเงิน", "Everything on this page is earned by playing only: nothing is sold", "このページのものはすべてプレイでのみ入手できます（課金・購入なし）"], ["ใกล้สำเร็จที่สุด", "Closest to done", "達成間近"],
  ["ทั้งหมด", "All", "すべて"], ["ยังล็อค", "Locked", "未解放"], ["ได้แล้ว", "Unlocked", "解放済み"], ["ยังไม่สำเร็จ", "Not yet", "未達成"], ["ปลดล็อคแล้ว", "Unlocked", "解放済み"], ["แสดง", "Show", "表示"], ["เด็คกล่องพิเศษ", "Special box decks", "特別ボックスデッキ"],
  ["ซ้อมมือเดียวแล้วชนะภายในเทิร์นที่ 5 ของเกม", "Win solo practice by turn 5", "一人回しで 5 ターン目までに勝つ"], ["ชนะโดยที่ LIFE ของเราไม่ถูกหงายเลยสักใบ", "Win without any of your LIFE turned up", "ライフを 1 枚も表にされずに勝つ"],
  ["ชนะด้วย Starter Deck ต่างกันครบ 7 เด็ค", "Win with 7 different Starter Decks", "7 種類のスターターデッキで勝つ"], ["ไต่ด่านผ่านครบทุกด่าน", "Clear every Gauntlet stage", "連戦モードを全クリア"],
  // history and ranks
  ["ประวัติการดวล", "Match history", "対戦履歴"], ["ทุกเกมที่จบจะบันทึกอัตโนมัติ ชิเอลใช้ข้อมูลนี้วิเคราะห์เด็ค", "Every finished game is saved; Ciel uses them to study your decks", "終わった対戦は自動で保存され、シエルがデッキ分析に使います"],
  ["ยังไม่มีเกมที่จบ เกมแรกของคุณจะมาอยู่ตรงนี้พร้อมรีเพลย์", "No finished games yet. Your first one will appear here with a replay", "まだ終わった対戦はありません。最初の対戦がリプレイ付きでここに並びます"],
  ["ไปสนามดวล", "Go to the arena", "対戦へ"], ["ดูของที่ยังล็อค วิธีปลดล็อค และความคืบหน้า", "See what is locked, how to unlock it and your progress", "未解放のもの・解放方法・進み具合を見る"],
  ["อันดับในกลุ่มเพื่อน", "Friends' ladder", "フレンドランキング"], ["คุณกับเพื่อนแต่ละคน", "You against each friend", "各フレンドとの対戦成績"], ["อัตราชนะแยกเด็ค", "Win rate by deck", "デッキ別勝率"],
  ["สัมฤทธิ์", "Bronze", "ブロンズ"], ["เงิน", "Silver", "シルバー"], ["ทอง", "Gold", "ゴールド"], ["แพลทินัม", "Platinum", "プラチナ"], ["เพชร", "Diamond", "ダイヤモンド"], ["ราชันย์", "Monarch", "王者"], ["รอจัดแรงก์", "Unranked", "ランク未確定"],
  ["แต้มอันดับ", "Ladder points", "ランキングポイント"],
  // settings
  ["ตั้งค่า", "Settings", "設定"], ["โปรไฟล์", "Profile", "プロフィール"], ["ชื่อที่แสดง", "Display name", "表示名"], ["อัปโหลดรูป", "Upload a picture", "画像をアップロード"],
  ["เลือกจากภาพการ์ด", "Pick from card art", "カード画像から選ぶ"], ["ใช้รูปจาก Google", "Use my Google picture", "Google の画像を使う"], ["บันทึกโปรไฟล์", "Save profile", "プロフィールを保存"],
  ["ภาษา", "Language", "言語"], ["อวตาร 3 มิติ สนาม ผ้าปูโต๊ะ และวงอัญเชิญ", "3D figure, scene, playmat and summon circle", "3D フィギュア・シーン・プレイマット・召喚陣"],
  ["⛶ เต็มจอ", "⛶ Full screen", "⛶ 全画面"], ["ทั้งฝั่ง", "Whole side", "自分側全体"], ["ผ้าปู", "Playmat", "プレイマット"], ["หลังการ์ด", "Card sleeve", "スリーブ"], ["อวตาร", "Figure", "フィギュア"], ["รอบโต๊ะ", "Around the table", "周りの景色"],
  ["▶ อัญเชิญ", "▶ Summon", "▶ 召喚"], ["▶ ฉากชนะ", "▶ Victory", "▶ 勝利演出"], ["ดูแบบ 3 มิติ", "View in 3D", "3D で見る"], ["หน้าตาเว็บ (ธีม)", "Site look (theme)", "サイトの見た目（テーマ）"],
  ["ทองบนรัก", "Gold on lacquer", "漆に金"], ["กระจกดารา", "Star glass", "星のガラス"], ["กราไฟต์", "Graphite", "グラファイト"], ["ไม่มี", "None", "なし"], ["อวตาร 3 มิติ", "3D figure", "3D フィギュア"],
  ["สนาม (ฉากรอบโต๊ะ)", "Scene (around the table)", "シーン（盤の周り）"], ["ผ้าปูโต๊ะ (playmat)", "Playmat", "プレイマット"], ["วงอัญเชิญ", "Summon circle", "召喚陣"], ["ฉากเมื่อชนะ", "Victory effect", "勝利演出"],
  ["ลายไทย", "Thai pattern", "タイ文様"], ["หลังการ์ดของฉัน", "My sleeve", "マイスリーブ"], ["ผ้าปูของฉัน", "My playmat", "マイプレイマット"], ["รูปปั้นของฉัน", "My figure", "マイフィギュア"], ["ภาพตั้งโต๊ะของฉัน", "My standee", "マイスタンド"],
  ["ภาพและความเร็ว", "Graphics and speed", "画質と速度"], ["คุณภาพภาพ", "Graphics quality", "画質"], ["สวยสุด", "Best", "最高"], ["ประหยัดเครื่อง", "Light", "軽量"], ["แบบเรียบ 2D", "Flat 2D", "シンプル 2D"],
  ["ประกายการ์ดหายาก", "Rare card shine", "レアカードの輝き"], ["เปิด", "On", "オン"], ["ความเร็วแอนิเมชัน", "Animation speed", "アニメーション速度"], ["เร็ว", "Fast", "速い"], ["เร็วมาก", "Very fast", "とても速い"],
  ["ขนาดตัวหนังสือ", "Text size", "文字サイズ"], ["ใหญ่", "Large", "大"], ["ใหญ่มาก", "Very large", "特大"], ["สั่นเมื่อโดนตี LIFE และถึงตาเรา", "Vibrate when your LIFE is hit and when your turn starts", "ライフへの攻撃と自分の番で振動"],
  ["สั่น", "Vibrate", "振動する"], ["ไม่สั่น", "No vibration", "振動しない"], ["เสียงและเพลง", "Sound and music", "サウンドと音楽"], ["เสียงเอฟเฟกต์", "Sound effects", "効果音"], ["เพลงประกอบ", "Music", "BGM"],
  ["แนวเพลงในสนาม", "Music in the arena", "対戦中の BGM"], ["แฟนตาซี", "Fantasy", "ファンタジー"], ["ปี่พาทย์", "Thai piphat", "タイ古典音楽"], ["เปิดเพลงเบาๆ ที่หน้าเมนูด้วย", "Soft music on the menus too", "メニューでも小さく BGM を流す"],
  ["ผู้ช่วยในเกม", "In-game help", "ゲーム内アシスト"], ["ถามย้ำก่อนใช้การ์ดและก่อนโจมตี (ใช้จริงไหม / ตีจริงไหม) กันกดพลาด", "Ask again before playing a card or attacking, so a mis-tap does nothing", "カード使用・攻撃の前に確認する（誤タップ防止）"],
  ["บอกคำแนะนำจากคู่มือเปลี่ยนมือตอนเริ่มเกม", "Show the mulligan guide's tip at the start", "開始時にマリガンガイドの助言を表示"], ["การแจ้งเตือน", "Notifications", "通知"], ["เจอปัญหา?", "Something wrong?", "問題がありますか？"],
  ["ปิด", "Off", "オフ"], ["บันทึก", "Save", "保存"], ["ยกเลิก", "Cancel", "キャンセル"], ["ลบ", "Delete", "削除"], ["ออกจากระบบ", "Sign out", "ログアウト"], ["แหล่งข้อมูลการ์ด", "Card data source", "カードデータの取得元"],
  ["ผู้เล่นในสนาม (เจ้าของเท่านั้น)", "Players (owner only)", "プレイヤー（オーナーのみ）"], ["อนุมัติแล้ว", "Approved", "承認済み"], ["ระงับ", "Suspend", "停止"], ["ชิเอล (Claude API)", "Ciel (Claude API)", "シエル（Claude API）"],
  ["โมเดลจัดเด็ค/อ่านการ์ด", "Model for deck building / card reading", "デッキ構築・カード読み取りのモデル"], ["ยังไม่มีภาพ", "No picture yet", "画像なし"], ["เลือกรูป", "Choose picture", "画像を選ぶ"], ["เปลี่ยนรูป", "Change picture", "画像を変更"],
  ["ดูบนโต๊ะ", "See on the table", "盤面で見る"], ["สนามดวล 3 มิติ", "3D arena", "3D 対戦盤"], ["ดูบนโต๊ะเต็มจอ", "See the table full screen", "盤面を全画面で見る"], ["มุมที่ดู", "Viewpoint", "視点"],
  ["กำลังตรวจสิทธิ์…", "Checking access…", "権限を確認中…"], ["กำลังโหลด…", "Loading…", "読み込み中…"], ["เข้าสู่ระบบด้วย Google", "Sign in with Google", "Google でログイン"], ["ลองใหม่", "Try again", "再試行"],
];
// texts with a number or a name in them: [pattern, English, Japanese] (a function gets the match and tr for the names)
const PATTERNS = [
  [/^นรก (\d+)$/, (m) => `Hell ${m[1]}`, (m) => `地獄 ${m[1]}`], [/^มิติมืด (\d+)$/, (m) => `Dark ${m[1]}`, (m) => `暗黒 ${m[1]}`],
  [/^(.+): กำลังเลือก…$/, (m, t) => `${t(m[1])}: choosing…`, (m, t) => `${t(m[1])}：選択中…`], [/^(.+): รอ$/, (m, t) => `${t(m[1])}: waiting`, (m, t) => `${t(m[1])}：待機`],
  [/^ชนะด้วยเด็คนี้ ปลดล็อค (.+)$/, (m) => `Win with this deck to unlock ${m[1]}`, (m) => `このデッキで勝つと ${m[1]} を解放`],
  [/^★ (\d+) ดาว$/, (m) => `★ ${m[1]} stars`, (m) => `★ ${m[1]}`], [/^เอซ: (.+)$/, (m) => `Ace: ${m[1]}`, (m) => `エース：${m[1]}`],
  [/^(.+) · เอซ: (.+)$/, (m) => `${m[1]} · Ace: ${m[2]}`, (m) => `${m[1]} · エース：${m[2]}`], [/^พบ (.+) · บอท$/, (m) => `vs ${m[1]} · Bot`, (m) => `相手：${m[1]} · ボット`],
  [/^อีก (\d+) ดาว ได้(.+) · ภารกิจใหม่ทุกเที่ยงคืน ทุกคนได้ภารกิจเดียวกัน$/, (m) => `${m[1]} more stars for ${m[2]} · new quests every midnight, the same for everyone`, (m) => `あと ${m[1]} 個で「${m[2]}」 · 毎日 0 時に全員共通の新ミッション`],
  [/^LIFE เหลือ (\d+) จาก (\d+) · ดู LIFE ที่หงายแล้ว$/, (m) => `${m[1]} of ${m[2]} LIFE left · see face-up LIFE`, (m) => `ライフ残り ${m[1]}/${m[2]} · 表向きのライフを見る`],
  [/^มือ (\d+) ใบ$/, (m) => `${m[1]} cards in hand`, (m) => `手札 ${m[1]} 枚`], [/^(\d+) เกม$/, (m) => `${m[1]} games`, (m) => `${m[1]} 戦`],
  [/^ชนะ (\d+) แพ้ (\d+)(?: เสมอ (\d+))?$/, (m) => `W ${m[1]} L ${m[2]}${m[3] ? ` D ${m[3]}` : ""}`, (m) => `${m[1]}勝 ${m[2]}敗${m[3] ? ` ${m[3]}分` : ""}`],
  [/^ชนะ (\d+) · แพ้ (\d+)(?: · เสมอ (\d+))?$/, (m) => `W ${m[1]} · L ${m[2]}${m[3] ? ` · D ${m[3]}` : ""}`, (m) => `${m[1]}勝 · ${m[2]}敗${m[3] ? ` · ${m[3]}分` : ""}`],
  [/^(.+) \(คุณ\)$/, (m) => `${m[1]} (you)`, (m) => `${m[1]}（あなた）`], [/^แรงก์ของคุณ: (.+)$/, (m, t) => `Your rank: ${t(m[1])}`, (m, t) => `あなたのランク：${t(m[1])}`],
  [/^(\d+) แต้ม · อีก (\d+) แต้มถึง(.+)$/, (m, t) => `${m[1]} pts · ${m[2]} to ${t(m[3])}`, (m, t) => `${m[1]} pt · ${t(m[3])}まであと ${m[2]}`],
  [/^(\d+) แต้ม · ขั้นสูงสุดแล้ว$/, (m) => `${m[1]} pts · top tier`, (m) => `${m[1]} pt · 最高ランク`], [/^เล่นอีก (\d+) เกมเพื่อจัดแรงก์ \(ตอนนี้ (\d+) แต้ม\)$/, (m) => `${m[1]} more games to be placed (now ${m[2]} pts)`, (m) => `あと ${m[1]} 戦でランク確定（現在 ${m[2]} pt）`],
  [/^ดวลกับเพื่อนให้จบ (\d+) เกมเพื่อจัดแรงก์$/, (m) => `Finish ${m[1]} friend games to be placed`, (m) => `フレンド対戦を ${m[1]} 戦終えるとランク確定`],
  [/^แรงก์: (.+) · อันดับในกลุ่มเพื่อน: ที่ (\d+) จาก (\d+) · (\d+) แต้ม \(ดูทั้งหมดในหน้าประวัติ\)$/, (m, t) => `Rank: ${t(m[1])} · friends' ladder: #${m[2]} of ${m[3]} · ${m[4]} pts (all in History)`, (m, t) => `ランク：${t(m[1])} · フレンド内 ${m[3]} 人中 ${m[2]} 位 · ${m[4]} pt（全体は履歴で）`],
  [/^(.+) ตั้งแต่ (\d+) แต้ม$/, (m, t) => `${t(m[1])} from ${m[2]} pts`, (m, t) => `${t(m[1])}：${m[2]} pt から`],
  [/^คิดจากเกมดวลกับเพื่อนที่จบแล้วของทุกคน เริ่มที่ 1000 แต้ม ชนะคนที่แต้มสูงกว่าจะได้แต้มมากกว่า · (\d+) เกมแรกเป็นเกมจัดแรงก์$/, (m) => `From everyone's finished friend games; everyone starts at 1000 and beating a higher-rated player earns more · the first ${m[1]} games place you`, (m) => `全員の終わったフレンド対戦から計算。初期値 1000、格上に勝つほど多く上がります · 最初の ${m[1]} 戦はランク判定戦`],
  [/^วิธีปลดล็อคที่เหลืออีก (\d+) อย่าง \(ได้จากการเล่นเท่านั้น\)$/, (m) => `How to unlock the other ${m[1]} (by playing only)`, (m) => `残り ${m[1]} 個の解放方法（プレイでのみ入手）`],
  [/^ดูนรกของ (.+)$/, (m, t) => `See ${t(m[1])}'s hell`, (m, t) => `${t(m[1])}の地獄を見る`], [/^ตาของ (.+)$/, (m, t) => `${t(m[1])}'s turn`, (m, t) => `${t(m[1])}の番`],
  [/^เทิร์น (\d+)$/, (m) => `Turn ${m[1]}`, (m) => `ターン ${m[1]}`], [/^คำใบ้: (.+)$/, (m) => `Hint: ${m[1]}`, (m) => `ヒント：${m[1]}`], [/^ไม่นับผล: (.+)$/, (m) => `No contest: ${m[1]}`, (m) => `無効試合：${m[1]}`],
  // the game log (engine.js): the lines seen every game; the card names in them stay Thai
  [/^เทิร์น (\d+) · (.+) จั่ว (\d+) ใบ$/, (m, t) => `Turn ${m[1]} · ${t(m[2])} draws ${m[3]}`, (m, t) => `ターン ${m[1]} · ${t(m[2])}が ${m[3]} 枚ドロー`],
  [/^เริ่มเกม · (.+) เริ่มก่อน$/, (m, t) => `Game start · ${t(m[1])} goes first`, (m, t) => `ゲーム開始 · ${t(m[1])}が先攻`], [/^(\S+) เลือกเริ่มก่อน$/, (m, t) => `${t(m[1])} chooses to go first`, (m, t) => `${t(m[1])}が先攻を選択`],
  [/^(\S+) เลือกเริ่มทีหลัง$/, (m, t) => `${t(m[1])} chooses to go second`, (m, t) => `${t(m[1])}が後攻を選択`], [/^(\S+) เก็บมือเดิม$/, (m, t) => `${t(m[1])} keeps the hand`, (m, t) => `${t(m[1])}は手札をキープ`],
  [/^(\S+) จบเทิร์น$/, (m, t) => `${t(m[1])} ends the turn`, (m, t) => `${t(m[1])}のターン終了`], [/^(\S+) ไม่ตอบโต้$/, (m, t) => `${t(m[1])} does not respond`, (m, t) => `${t(m[1])}は対応しない`],
  [/^(\S+) จั่ว (\d+) ใบ$/, (m, t) => `${t(m[1])} draws ${m[2]}`, (m, t) => `${t(m[1])}が ${m[2]} 枚ドロー`],
  [/^โยนเหรียญ: ออกหน้า (.+) · (.+) ได้เลือกว่าจะเริ่มก่อนหรือทีหลัง$/, (m, t) => `Coin: ${t(m[1])}'s face · ${t(m[2])} chooses to go first or second`, (m, t) => `コイン：${t(m[1])}の面 · ${t(m[2])}が先攻・後攻を選択`],
  [/^(.+) แต้มมากกว่า ได้เลือกว่าจะเริ่มก่อนหรือทีหลัง$/, (m, t) => `${t(m[1])} rolled higher and chooses to go first or second`, (m, t) => `${t(m[1])}の目が大きく、先攻・後攻を選択`],
  [/^เลือกไม่ตรงกัน \((.+): (.+) · (.+): (.+)\) ระบบสุ่มได้: (.+)$/, (m, t) => `Different picks (${t(m[1])}: ${t(m[2])} · ${t(m[3])}: ${t(m[4])}), drawn: ${t(m[5])}`, (m, t) => `選択が不一致（${t(m[1])}：${t(m[2])} · ${t(m[3])}：${t(m[4])}）抽選結果：${t(m[5])}`],
  [/^ทั้งสองฝ่ายเลือก(.+)$/, (m, t) => `Both picked: ${t(m[1])}`, (m, t) => `両者とも${t(m[1])}を選択`],
  ["เทิร์นแรกของผู้เริ่มก่อนไม่มี Battle Phase", "The first player's first turn has no Battle Phase", "先攻の最初のターンはバトルフェイズなし"],
  [/^อัญเชิญ (.+) \(จ่าย (\d+) ใบ GEM (\d+)\/(\d+)\)(.*)$/, (m) => `Summon ${m[1]} (paid ${m[2]} card${m[2] === "1" ? "" : "s"}, GEM ${m[3]}/${m[4]})${m[5].replace(" · พอดี!", " · exact!")}`, (m) => `${m[1]}を召喚（${m[2]} 枚支払い GEM ${m[3]}/${m[4]}）${m[5].replace(" · พอดี!", " · ぴったり！")}`],
  [/^ก่อสร้าง (.+) \(จ่าย (\d+) ใบ GEM (\d+)\/(\d+)\)$/, (m) => `Build ${m[1]} (paid ${m[2]} card${m[2] === "1" ? "" : "s"}, GEM ${m[3]}/${m[4]})`, (m) => `${m[1]}を建設（${m[2]} 枚支払い GEM ${m[3]}/${m[4]}）`],
  [/^ใช้ (Normal|React|Land|Modification) Magic (.+)$/, (m) => `Play ${m[1]} Magic ${m[2]}`, (m) => `${m[1]} マジック ${m[2]}を使用`], [/^สวมใส่ (.+) ให้ (.+)$/, (m) => `Equip ${m[1]} to ${m[2]}`, (m) => `${m[1]}を${m[2]}に装備`],
  [/^สั่งใช้ความสามารถ (.+)$/, (m) => `Activate ${m[1]}`, (m) => `${m[1]}の能力を起動`], [/^เอฟเฟกต์ (.+?): (.+)$/, (m) => `Effect of ${m[1]}: ${m[2].replace(/^อ่านอัตโนมัติ: /, "")}`, (m) => `${m[1]}の効果：${m[2].replace(/^อ่านอัตโนมัติ: /, "")}`],
  [/^(.+) \(POWER (\d+)\) โจมตี LIFE$/, (m) => `${m[1]} (POWER ${m[2]}) attacks LIFE`, (m) => `${m[1]}（POWER ${m[2]}）がライフを攻撃`], [/^(.+) \(POWER (\d+)\) โจมตี (.+)$/, (m) => `${m[1]} (POWER ${m[2]}) attacks ${m[3]}`, (m) => `${m[1]}（POWER ${m[2]}）が${m[3]}を攻撃`],
  [/^LIFE ของ (.+) ถูกหงาย: (.+)$/, (m, t) => `${t(m[1])}'s LIFE turns up: ${m[2]}`, (m, t) => `${t(m[1])}のライフが表に：${m[2]}`], [/^(.+) กำลังจะถูกทำลายจากการต่อสู้$/, (m) => `${m[1]} is about to be destroyed in the fight`, (m) => `${m[1]}は戦闘で破壊されようとしています`],
  [/^(.+) ถูกทำลาย \(แพ้การต่อสู้ (\d+) ต่อ (\d+)\)$/, (m) => `${m[1]} is destroyed (lost the fight ${m[2]} to ${m[3]})`, (m) => `${m[1]}は破壊された（戦闘 ${m[2]} 対 ${m[3]} で敗北）`], [/^(.+) ถูกทำลาย \(พลังเท่ากัน (\d+)\)$/, (m) => `${m[1]} is destroyed (equal POWER ${m[2]})`, (m) => `${m[1]}は破壊された（POWER ${m[2]} で相打ち）`],
  [/^(.+) ถูกทำลาย \((.+)\)$/, (m) => `${m[1]} is destroyed (${m[2]})`, (m) => `${m[1]}は破壊された（${m[2]}）`], [/^(.+) เข้าสู่สถานะสาหัส$/, (m, t) => `${t(m[1])} is now critical`, (m, t) => `${t(m[1])}は瀕死状態に`],
  [/^(.+) ชนะ · (.+) โจมตี LIFE ขณะ (.+) อยู่ในสถานะสาหัส$/, (m, t) => `${t(m[1])} wins · ${t(m[2])} hit LIFE while ${t(m[3])} was critical`, (m, t) => `${t(m[1])}の勝利 · 瀕死の${t(m[3])}のライフを${t(m[2])}が攻撃`],
  [/^สอดแนม (\d+) ใบ: (.+)$/, (m) => `Scout ${m[1]}: ${m[2]}`, (m) => `${m[1]} 枚スカウト：${m[2]}`], [/^การ์ดที่เหลือ (\d+) ใบ ไว้ใต้ Deck$/, (m) => `The other ${m[1]} go under the Deck`, (m) => `残り ${m[1]} 枚はデッキの下へ`],
  [/^ทิ้ง (.+) ลงนรก$/, (m) => `${m[1]} is discarded to hell`, (m) => `${m[1]}を地獄へ捨てる`], [/^ค้นหา (.+) จาก Deck → มือ · สับ Deck$/, (m) => `Search ${m[1]} from the Deck → hand · shuffle`, (m) => `デッキから${m[1]}を手札へ · シャッフル`],
  [/^(.+): (Deck|นรก|มือ|Avatar Zone|Magic Zone|Construct Zone|มิติมืด) → (Deck|นรก|มือ|Avatar Zone|Magic Zone|Construct Zone|มิติมืด|deckBottom)$/, (m, t) => `${m[1]}: ${t(m[2])} → ${t(m[3])}`, (m, t) => `${m[1]}：${t(m[2])} → ${t(m[3])}`],
  [/^(.+) POWER ([+-]\d+) \(ตอนนี้ (\d+)\)$/, (m) => `${m[1]} POWER ${m[2]} (now ${m[3]})`, (m) => `${m[1]} POWER ${m[2]}（現在 ${m[3]}）`], [/^รอทำงานใน Main Phase ถัดไป$/, () => "Waits for the next Main Phase", () => "次のメインフェイズで処理"],
  [/^(\S{1,24}) ใช้ (.+)$/, (m, t) => `${t(m[1])} played ${m[2]}`, (m, t) => `${t(m[1])}が${m[2]}を使用`], [/^บอท · (.+)$/, (m) => `Bot · ${m[1]}`, (m) => `ボット · ${m[1]}`],
  [/^(\S+) เปลี่ยนมือ (\d+) ใบ$/, (m, t) => `${t(m[1])} mulligans ${m[2]}`, (m, t) => `${t(m[1])}が ${m[2]} 枚マリガン`], [/^(\S+) ทอยเต๋าได้ (\d+)$/, (m, t) => `${t(m[1])} rolls ${m[2]}`, (m, t) => `${t(m[1])}の出目は ${m[2]}`],
  ["เปลี่ยนมือ (ทำได้ครั้งเดียว)", "Mulligan (once only)", "マリガン（1 回のみ）"], ["มือ", "Hand", "手札"],
  [/^(.+) \(ชิเอลจัด\)$/, (m) => `${m[1]} (by Ciel)`, (m) => `${m[1]}（シエル構築）`], [/^(.+) \(ทางการ\)$/, (m) => `${m[1]} (official)`, (m) => `${m[1]}（公式）`],
  [/^([\d,]+) ใบ$/, (m) => `${m[1]} cards`, (m) => `${m[1]} 枚`], [/^แสดงเพิ่ม (\d+) ใบ$/, (m) => `Show ${m[1]} more`, (m) => `さらに ${m[1]} 枚表示`], [/^อีก (\d+)$/, (m) => `${m[1]} to go`, (m) => `あと ${m[1]}`],
  [/^จาก (\d+) ชิ้น$/, (m) => `of ${m[1]}`, (m) => `/ ${m[1]} 個`], [/^(.+) · ได้แล้ว (\d+)\/(\d+)$/, (m, t) => `${t(m[1])} · ${m[2]}/${m[3]} unlocked`, (m, t) => `${t(m[1])} · ${m[2]}/${m[3]} 解放`],
  [/^(.+) · ยังไม่สำเร็จ$/, (m) => `${m[1]} · not yet`, (m) => `${m[1]} · 未達成`], [/^GEM รวม (\d+)$/, (m) => `GEM total ${m[1]}`, (m) => `GEM 合計 ${m[1]}`], [/^ทุกเด็คตัวอย่าง \((\d+) เด็ค\)$/, (m) => `Every sample deck (${m[1]})`, (m) => `全サンプルデッキ（${m[1]}）`],
  [/^สุ่มมือเปิด (\d+) ใบ$/, (m) => `Draw an opening hand of ${m[1]}`, (m) => `初手 ${m[1]} 枚を引く`],
  [/^ชนะบอทหรือเพื่อน (\d+) เกม$/, (m) => `Win ${m[1]} game${m[1] === "1" ? "" : "s"} against the bot or a friend`, (m) => `ボットかフレンドに ${m[1]} 勝`], [/^ชนะบอทมือโปร (\d+) เกม$/, (m) => `Win ${m[1]} against the Pro bot`, (m) => `プロボットに ${m[1]} 勝`],
  [/^ดวลกับเพื่อนครบ (\d+) เกม$/, (m) => `Play ${m[1]} friend games`, (m) => `フレンドと ${m[1]} 戦`], [/^สะสมดาวจากภารกิจประจำวัน (\d+) ดวง$/, (m) => `Collect ${m[1]} daily-quest stars`, (m) => `デイリーミッションの星を ${m[1]} 個集める`],
  [/^ไขโจทย์ปริศนาสำเร็จ (\d+) ข้อ$/, (m) => `Solve ${m[1]} puzzles`, (m) => `パズルを ${m[1]} 問解く`], [/^ชนะบอทหรือเพื่อนติดกัน (\d+) เกม$/, (m) => `Win ${m[1]} in a row`, (m) => `${m[1]} 連勝`], [/^ไต่ด่านผ่าน (\d+) ด่าน$/, (m) => `Clear ${m[1]} Gauntlet stages`, (m) => `連戦モードを ${m[1]} 面クリア`],
  [/^ชนะด้วยเด็คที่มี Symbol (.+) 30 ใบขึ้นไป$/, (m, t) => `Win with a deck of 30+ ${t(m[1])} cards`, (m, t) => `${t(m[1])}のカード 30 枚以上のデッキで勝つ`],
  [/^ชนะบอทหรือเพื่อนด้วยเด็คที่มีการ์ด Symbol (.+) อย่างน้อย 30 ใบ$/, (m, t) => `Win with a deck holding at least 30 ${t(m[1])} cards`, (m, t) => `${t(m[1])}のカードを 30 枚以上入れたデッキで勝つ`],
  [/^([^:]{1,30}): ((?:ชนะ|ดวล|สะสม|ไข|ซ้อม|ไต่).+)$/, (m, t) => `${m[1]}: ${t(m[2])}`, (m, t) => `${m[1]}：${t(m[2])}`],
  [/^🔒 (.+)$/, (m, t) => `🔒 ${t(m[1])}`, (m, t) => `🔒 ${t(m[1])}`], [/^(.+) · ตั้งค่า$/, (m) => `${m[1]} · Settings`, (m) => `${m[1]} · 設定`],
];

// the same Thai word reads differently as a button's name: ปิด is "Off" on a switch but "Close" on the ✕ button
const ATTR_WORDS = [["ปิด", "Close", "閉じる"]];
const L = lang(), K = L === "en" ? 1 : 2, MAP = new Map(WORDS.map((w) => [w[0], w[K]])), AMAP = new Map(ATTR_WORDS.map((w) => [w[0], w[K]]));
const THAI = /[฀-๿]/;
// one piece of text in the chosen language (unchanged when nothing matches)
export function tr(s) {
  if (L === "th" || !s || !THAI.test(s)) return s;
  const t = look(s); if (t !== s || isOwnerNow() || !s.includes("ผู้ช่วย")) return anon(t);
  // another account's page already reads ผู้ช่วย where the owner's reads ชิเอล: the same entry, then the nameless helper
  const u = look(s.replace(/ผู้ช่วย/g, "ชิเอล")); return u.includes("ชิเอล") ? s : anon(u);
}
function look(s) {
  const hit = MAP.get(s); if (hit) return hit;
  for (const p of PATTERNS) { if (typeof p[0] === "string") { if (p[0] === s) return p[K]; continue; } const m = p[0].exec(s); if (m) return p[K](m, tr); }
  return s;
}
// Ciel is the owner's alone (persona.js): in English and Japanese every other account gets the nameless helper too
const ANON = L === "en" ? [[/\bCiel's\b/g, "the assistant's"], [/\bCiel\b/g, "the assistant"], [/^([^A-Za-z]*)the a/, "$1The a"]] : [[/シエル/g, "アシスタント"]];
function anon(t) { if (isOwnerNow() || !/Ciel|シエル/.test(t)) return t; for (const [a, b] of ANON) t = t.replace(a, b); return t; }
// keep the spaces round a text node's words
const trNode = (v) => { const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v); const t = tr(m[2]); return t === m[2] ? v : m[1] + t + m[3]; };
const SKIP = "script,style,textarea,input,[contenteditable],.noi18n,pre,code,.fx,.kwgloss"; // .fx: card text (its keywords open the glossary by their Thai word)
const ATTRS = ["placeholder", "title", "aria-label"];
function attrs(el) { for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && THAI.test(v)) { const t = AMAP.get(v) || tr(v); if (t !== v) el.setAttribute(a, t); } } }
function walk(node) {
  if (node.nodeType === 3) { const p = node.parentElement; if (p && !p.closest(SKIP) && THAI.test(node.nodeValue)) { const t = trNode(node.nodeValue); if (t !== node.nodeValue) node.nodeValue = t; } return; }
  if (node.nodeType !== 1 || node.closest(SKIP)) return;
  attrs(node); for (const el of node.querySelectorAll("[placeholder],[title],[aria-label]")) attrs(el);
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let n; const list = []; while ((n = w.nextNode())) list.push(n); for (const x of list) walk(x);
}
// start the watcher (nothing to do for Thai)
export function startI18n() {
  if (L === "th") return;
  document.documentElement.lang = L;
  if (L === "ja") { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap"; document.head.append(l); document.documentElement.classList.add("lang-ja"); }
  walk(document.body);
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === "childList") m.addedNodes.forEach(walk); else if (m.type === "characterData") walk(m.target); else if (m.type === "attributes") attrs(m.target); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
