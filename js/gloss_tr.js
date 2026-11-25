// The rules glossary in English and Japanese (our own words, translated from glossary.js). Each entry, by the Thai
// keyword (which stays as it is printed on the Thai cards): [name, short, long] per language.
export const GLOSS_TR = {
  "ต่อเนื่อง": {
    en: ["Continuous", "Applies all the time this card is in a zone where it works", "No command and no timing: as long as the card stays in a zone where the ability works (for example an Avatar on the Avatar Zone), the effect lasts. As soon as the card leaves that zone, the effect is gone."],
    ja: ["永続", "このカードが有効なゾーンにある間、常に効果がある", "宣言もタイミングも不要。能力が働くゾーンにある限り（例：アバターゾーンのアバター）効果は続き、そのゾーンを離れると即座に消える。"],
  },
  "อัตโนมัติ": {
    en: ["Automatic", "Works by itself when the written event happens", "The player does not choose to use it. When the condition after \"when…\" happens, the ability works on its own. If several happen at once, the cards' owner decides the order."],
    ja: ["自動", "書かれた出来事が起きると自動で働く", "プレイヤーが使うか選ぶものではない。「〜したとき」の条件が起きると自動で働く。同時に複数起きたら、カードの持ち主が順番を決める。"],
  },
  "สั่งใช้": {
    en: ["Activated", "The player chooses to use it: pay what is before the colon, get what is after it", "Usable while the card is in the stated zone and condition. If the card names no timing, only in your own Main Phase; if it names one (such as \"when an Avatar battles\" or \"in any turn\"), at that timing. The text before the colon is the cost or condition, after it the effect."],
    ja: ["起動", "プレイヤーが使う：「:」の前を支払い、後ろの効果を得る", "カードが指定するゾーンと条件を満たすときに使える。タイミングの指定がなければ自分のメインフェイズのみ、指定があれば（「アバターがバトルするとき」「どちらのターンでも」など）そのタイミングで使える。「:」の前はコストや条件、後ろは効果。"],
  },
  "เทิร์นละครั้ง": {
    en: ["Once per turn", "Can be used or work once each turn", "Counted per card. Even if an Avatar is moved to the Magic Zone and summoned back in the same turn, it cannot use it again. Written as \"#once per turn\" with the name, it counts every card of that name together."],
    ja: ["ターン1回", "1ターンに1回だけ使える・働く", "カード1枚ごとに数える。同じターンにアバターがマジックゾーンへ移ってから再び召喚されても、もう一度は使えない。名前に「#ターン1回」とあれば、同名カード全体で1回。"],
  },
  "เลือกปฏิบัติ": {
    en: ["Choose one", "Do one of the listed options", "When the card is used, pick one of its numbered options. Some cards allow more than one when their written condition is met."],
    ja: ["選択", "並んだ選択肢から1つを行う", "カードを使うとき、番号付きの選択肢から1つを選ぶ。条件を満たすと複数選べるカードもある。"],
  },
  "จุติ": {
    en: ["Incarnate", "Works when this Avatar is summoned by paying its Cost", "Only a summon where the player paid the Cost, or a card that clearly says \"summon as incarnate\". An Avatar summoned free by another ability does not trigger it."],
    ja: ["降臨", "このアバターがコストを支払って召喚されたときに働く", "プレイヤーがコストを支払った召喚か、「降臨として召喚」と明記したカードの場合のみ。他の能力で無料召喚されたときは働かない。"],
  },
  "คำสั่งเสีย": {
    en: ["Last words", "Works after this Avatar is destroyed", "Happens after the Avatar is destroyed and has gone to hell, whether by battle or by a card ability. Leaving the field any other way (banished, returned to hand, or sent to hell without being destroyed) does not trigger it."],
    ja: ["遺言", "このアバターが破壊された後に働く", "バトルでも能力でも、破壊されて地獄へ行った後に起きる。追放・手札に戻る・破壊されずに地獄へ送られるなど、他の方法で場を離れた場合は働かない。"],
  },
  "พอดี": {
    en: ["Exact", "Gains an ability when summoned with GEM exactly equal to its Cost", "If the GEM of the discarded cards adds up exactly to the Avatar's Cost, it gains the ability written after \"exact\". Overpaying does not count."],
    ja: ["ぴったり", "コストとちょうど同じGEMで召喚すると能力を得る", "支払いで捨てたカードのGEM合計がアバターのコストとちょうど同じなら、「ぴったり」の後に書かれた能力を得る。払いすぎると得られない。"],
  },
  "โล่มนุษย์": {
    en: ["Human shield", "When the other side attacks, turn this card from awake to asleep and take the attack instead", "Usable once the attacker has chosen a target. The Avatar with it must be awake on the Avatar Zone; it goes to sleep and becomes the new target. It also stops a Low blow attack."],
    ja: ["人間の盾", "相手が攻撃したとき、このカードを起きから寝にして代わりに攻撃を受ける", "相手が対象を選んだ後に使える。人間の盾を持つアバターはアバターゾーンで起きている必要があり、寝になって新しい対象になる。急所蹴りの攻撃も防げる。"],
  },
  "สามัคคี": {
    en: ["Unity", "Put this card to sleep and add its POWER to your attacking Avatar", "When you attack, an awake Avatar with Unity goes to sleep and its POWER is added to the attacker until the end of the battle (or of the attack, if it hits LIFE)."],
    ja: ["団結", "このカードを寝にして、攻撃中の自分のアバターにパワーを加える", "自分が攻撃するとき、団結を持つ起きているアバターが寝になり、そのパワーをバトル終了まで（ライフ攻撃なら攻撃終了まで）攻撃側に加える。"],
  },
  "แทงหลัง": {
    en: ["Backstab", "Helps the other side when it is hit: +1 to the attacker, but if their colours differ the attacker is destroyed after the battle", "This card goes from awake to asleep and adds POWER to the other side's attacker. Then, if the attacking Avatar's colour differs from this card's, the attacker is destroyed when the battle ends."],
    ja: ["背後討ち", "攻撃されたとき相手を助ける：攻撃側に+1、ただし色が違えばバトル後に攻撃側が破壊される", "このカードは起きから寝になり、相手の攻撃側にパワーを加える。攻撃したアバターの色がこのカードと違えば、バトル終了時に攻撃側が破壊される。"],
  },
  "ลูกฮึด": {
    en: ["Grit", "Wins a battle against an Avatar of equal POWER", "Normally equal POWER destroys both, but the card with Grit wins. If both have Grit, both are destroyed as usual."],
    ja: ["根性", "パワーが同じアバターとのバトルに勝つ", "通常パワーが同じなら両方破壊されるが、根性を持つ側が勝つ。両方が根性を持つなら、通常どおり両方破壊される。"],
  },
  "เตะไข่": {
    en: ["Low blow", "Can attack LIFE right away even when the other side has Avatars", "Normally you must attack an Avatar first if the other side has any on the Avatar Zone, but a card with Low blow can go straight for LIFE. The defender can still use Human shield."],
    ja: ["急所蹴り", "相手にアバターがいてもすぐライフを攻撃できる", "通常、相手のアバターゾーンにアバターがいれば先にアバターを攻撃しなければならないが、急所蹴りを持つカードは直接ライフを攻撃できる。防御側は人間の盾で防げる。"],
  },
  "Link": {
    en: ["Link", "Gains a partner ability while partnered with the named card", "A card with [Link …] gains its partner ability once it is partnered as the card says. If the partnership ends, the partner ability is lost."],
    ja: ["リンク", "指定カードとパートナー状態の間、パートナー能力を得る", "[リンク …]を持つカードは、カードの指示どおりパートナー状態になるとパートナー能力を得る。その状態を離れると能力を失う。"],
  },
  "สอดแนม": {
    en: ["Scout", "Look at that many cards from the top of the Deck", "Look at that many cards from the top of your Deck and do what the card says (such as putting some into your hand). The rest go back as written. If the card does not say whose Deck, it is always yours."],
    ja: ["偵察", "デッキの上から指定枚数を見る", "自分のデッキの上から指定枚数を見て、カードの指示（一部を手札に加えるなど）に従う。残りは書かれたとおりに戻す。誰のデッキか書かれていなければ、常に自分のデッキ。"],
  },
  "ธรณีสูบ": {
    en: ["Mill", "Send that many cards from the top of the Deck to hell", "Put that many cards from the top of the Deck into hell. If it does not say whose Deck, it is yours. Running out of Deck loses the game at once, so take care when it is a cost."],
    ja: ["地呑み", "デッキの上から指定枚数を地獄へ送る", "デッキの上から指定枚数を地獄に置く。誰のデッキか書かれていなければ自分のデッキ。デッキが尽きると即敗北なので、コストとして使うときは注意。"],
  },
  "เนรเทศ": {
    en: ["Banish", "Send a card to the dark dimension, out of the game", "A banished card goes to the dark dimension (Dark Dimension Zone), not to hell, so it does not count as destroyed and Last words do not work."],
    ja: ["追放", "カードを闇次元へ送り、ゲームから除外する", "追放されたカードは地獄ではなく闇次元（ダークディメンションゾーン）へ行く。破壊扱いではないので、遺言は働かない。"],
  },
  "เซ่นไหว้": {
    en: ["Offering", "Destroy your own Avatar into hell as a cost", "Pay the cost by destroying Avatars on your Avatar Zone as the card says. They go to hell and count as destroyed."],
    ja: ["生贄", "コストとして自分のアバターを破壊して地獄へ送る", "カードの指示どおり自分のアバターゾーンのアバターを破壊してコストを支払う。そのアバターは地獄へ行き、破壊されたものとして扱う。"],
  },
  "สวมใส่": {
    en: ["Equip", "Attach a Modification Magic to an Avatar", "A Modification Magic stays attached to one Avatar to add POWER or an ability. If that Avatar leaves the field, or no longer meets the equip condition, the attached card goes to hell."],
    ja: ["装着", "装着マジックをアバターに付ける", "装着マジックはアバター1体に付いてパワーや能力を加える。そのアバターが場を離れたり装着条件を満たさなくなると、付いていたカードは地獄へ行く。"],
  },
  "เปลี่ยนการควบคุม": {
    en: ["Change control", "Move an Avatar to the other player's side", "The Avatar moves to the other side's Avatar Zone under their control. It does not count as leaving the field. If the card says \"until the end of the turn\", it returns to its owner when the turn ends."],
    ja: ["コントロール奪取", "アバターを相手側へ移す", "アバターは相手のアバターゾーンへ移り、相手のコントロール下になる。場を離れた扱いにはならない。「ターン終了まで」とあれば、ターン終了時に持ち主へ戻る。"],
  },
  "แสดง": {
    en: ["Reveal", "Show a card in hand to the other side", "Show a card from your hand as a cost or condition, then keep it in your hand. It is not discarded."],
    ja: ["公開", "手札のカードを相手に見せる", "コストや条件として手札のカードを見せ、そのまま手札に戻す。捨てるわけではない。"],
  },
  "สาหัส": {
    en: ["Critical", "All LIFE is face up: one more hit to LIFE loses the game", "When every LIFE Card has been turned face up, the player is critical. One more attack to LIFE and they lose."],
    ja: ["瀕死", "ライフがすべて表向き：もう一度ライフを攻撃されると負け", "ライフカードがすべて表になると瀕死状態になる。もう一度ライフを攻撃されると負け。"],
  },
  "Avatar": {
    en: ["Avatar", "A character card that goes on the field to attack and defend", "Summoned to the Avatar Zone by discarding cards whose GEM covers the Cost. Up to 4 (6 with Tokens). It comes in awake, so it can attack in that turn's Battle Phase."],
    ja: ["アバター", "場に出て攻撃と防御をするキャラクターカード", "GEMでコストを満たすようにカードを捨ててアバターゾーンに召喚する。最大4体（トークン込みで6体）。起きた状態で出るので、そのターンのバトルフェイズに攻撃できる。"],
  },
  "Token": {
    en: ["Token", "A stand-in Avatar made by a card ability", "Follows every Avatar rule, attacking and battling included, and abilities that affect Avatars affect it too. When it leaves the Avatar Zone it is gone from the game. The Avatar Zone holds 4 Avatars, at most 6 with Tokens."],
    ja: ["トークン", "カード能力で生まれる代わりのアバター", "攻撃やバトルを含めアバターのルールにすべて従い、アバターへの効果も受ける。アバターゾーンを離れるとゲームから消える。アバターゾーンは4体まで、トークン込みで6体まで。"],
  },
  "Construct": {
    en: ["Construct", "A building card placed in the Construct Zone", "Built into the Construct Zone by paying GEM, like an Avatar. Up to 3, with different names. One with POWER can be attacked and battle."],
    ja: ["コンストラクト", "コンストラクトゾーンに置く建造物カード", "アバターと同じくGEMを支払ってコンストラクトゾーンに建てる。最大3枚、同名は不可。パワーを持つものは攻撃対象になりバトルできる。"],
  },
  "Normal Magic": {
    en: ["Normal Magic", "Everyday Magic, used in your Main Phase, then goes to hell", "Usable in your own Main Phase. After its effect the card goes to hell. Each kind of Magic can be used once per turn."],
    ja: ["ノーマルマジック", "自分のメインフェイズに使い、その後地獄へ行く通常マジック", "自分のメインフェイズに使える。効果の後カードは地獄へ。マジックは種類ごとに1ターン1回まで。"],
  },
  "Modification Magic": {
    en: ["Modification Magic", "Magic that is equipped to an Avatar", "One per Avatar. Adds POWER or an ability. Its equip condition is checked all the time."],
    ja: ["装着マジック", "アバターに装着するマジック", "アバター1体につき1枚。パワーや能力を加える。装着条件は常にチェックされる。"],
  },
  "React Magic": {
    en: ["React Magic", "Magic that answers back, even outside your turn", "Usable at the timing the card names, such as when you are attacked. With no timing named, usable when the other side takes an action or before the Battle Phase, while no other ability is working. One per turn."],
    ja: ["リアクトマジック", "自分のターン以外でも使える対応マジック", "攻撃されたときなど、カードが指定するタイミングで使える。指定がなければ、相手が行動したときかバトルフェイズの前で、他の能力が働いていないときに使える。1ターン1枚まで。"],
  },
  "Land Magic": {
    en: ["Land Magic", "A field Magic that affects everyone, one at a time", "Placed in the Land Magic Zone, which both sides share. It affects every player; whoever played it owns it. When someone plays a new one, the old one goes to its owner's hell."],
    ja: ["ランドマジック", "全員に効果がある場のマジック、1枚ずつ", "両者共有のランドマジックゾーンに置く。全プレイヤーに効果があり、出した人が持ち主。新しいものが出ると、古いものは持ち主の地獄へ。"],
  },
  "LIFE Card": {
    en: ["LIFE Card", "Your 5 life cards, turned face up when you are hit", "Each attack to LIFE turns one LIFE Card face up. Some have an ability when turned. Once all are face up you are critical, and one more hit loses."],
    ja: ["ライフカード", "攻撃されると表になる5枚のライフ", "ライフへの攻撃1回ごとにライフカードが1枚表になる。表になったとき能力を持つものもある。すべて表になると瀕死で、もう一度攻撃されると負け。"],
  },
  "Only #1": {
    en: ["Only #1", "One copy per deck", "A card with the Only #1 mark can be in a Deck once at most, and a Deck can hold only one Only #1 card of any kind."],
    ja: ["オンリー#1", "デッキに1枚まで", "オンリー#1マークのカードはデッキに1枚まで。さらに種類を問わず、デッキに入れられるオンリー#1カードは1枚だけ。"],
  },
  "ลำเอียง": {
    en: ["Biased", "A card not allowed in official tournament Decks", "Cards with the biased mark can still be played with friends or against the bot, but not in Decks for regular competition (this site's friends' tournaments do not take them either)."],
    ja: ["偏り", "公式大会のデッキに入れられないカード", "偏りマークのカードは友達やボットとの対戦では使えるが、通常の大会用デッキには入れられない（このサイトの友達トーナメントも不可）。"],
  },
  "โดนใจ": {
    en: ["Collab", "A collaboration card that is tournament legal", "A special card made with another brand. It goes in competitive Decks as normal."],
    ja: ["コラボ", "大会で使えるコラボカード", "他ブランドとのコラボによる特別なカード。通常どおり大会用デッキに入れられる。"],
  },
  "Symbol": {
    en: ["Symbol", "A card's tribe or group, such as {God} or {Hell}", "Many cards refer to a Symbol to choose targets or count. For example \"Avatar {Symbol God}\" means an Avatar with the God Symbol."],
    ja: ["シンボル", "カードの種族やグループ（{神}{地獄}など）", "多くのカードが対象選択や数えるためにシンボルを参照する。例：「アバター{シンボル 神}」は神シンボルを持つアバターのこと。"],
  },
  "Avatar Zone": {
    en: ["Avatar Zone", "Where Avatars that attack and defend stand", "Holds up to 4 Avatars, at most 6 with Tokens. Avatars here can attack and can be targeted by attacks."],
    ja: ["アバターゾーン", "攻撃と防御をするアバターを置く場所", "アバターは最大4体、トークン込みで6体まで。ここのアバターは攻撃でき、攻撃の対象にもなる。"],
  },
  "Magic Zone": {
    en: ["Magic Zone", "Where Magic that stays on the field sits, and Avatars moved there", "An Avatar moved here still counts as an Avatar and has POWER, but cannot attack, cannot use abilities (unless the card says so) and cannot be chosen as an attack target. Summoned back to the Avatar Zone, it is a new card and loses every bonus it had."],
    ja: ["マジックゾーン", "場に残るマジックや、移されたアバターを置く場所", "ここへ移されたアバターはアバター扱いでパワーもあるが、攻撃できず、能力も使えず（カードの指定を除く）、攻撃対象にも選ばれない。アバターゾーンへ召喚し直すと新しいカードになり、増えた値はすべて消える。"],
  },
  "นรก": {
    en: ["Hell", "Each side's discard pile", "Cards that were destroyed, used up or milled end up here, open for everyone to see. Many abilities count or take cards from hell. If a card does not say whose hell, the official FAQ counts both sides'."],
    ja: ["地獄", "それぞれの捨て札置き場", "破壊・使用済み・地呑みされたカードがここに来て、誰でも見られる。地獄のカードを数えたり取り出す能力も多い。誰の地獄か書かれていなければ、公式FAQでは両者の地獄を数える。"],
  },
  "มิติมืด": {
    en: ["Dark dimension", "Where banished cards go", "A banished card ends up here and is out of the game. It is not in hell."],
    ja: ["闇次元", "追放されたカードの行き先", "追放されたカードはここに来て、ゲームから除外された扱いになる。地獄にはない。"],
  },
  "Land Magic Zone": {
    en: ["Land Magic Zone", "The slot in the middle of the field for Land Magic, shared by both sides", "Holds only 1 Land Magic. A new one replaces the old one."],
    ja: ["ランドマジックゾーン", "場の中央にある両者共有のランドマジック置き場", "ランドマジックは1枚だけ。新しいものが古いものと入れ替わる。"],
  },
  "Cost": {
    en: ["Cost", "What a summon costs, paid by discarding cards with GEM", "Discard cards from your hand whose GEM adds up to the Cost. A card with 0 GEM cannot pay. Coloured GEM pays only for an Avatar of the same colour. Overpaying is allowed, but you may not discard more cards than needed. An Avatar with Cost 0 is summoned straight away."],
    ja: ["コスト", "召喚に必要な値。GEMを持つカードを捨てて支払う", "手札からGEM合計がコストに届くようにカードを捨てる。GEM0のカードでは払えない。色付きGEMは同じ色のアバターにしか使えない。払いすぎは可能だが、必要以上の枚数は捨てられない。コスト0のアバターはそのまま召喚できる。"],
  },
  "POWER": {
    en: ["POWER", "An Avatar's strength, compared in battle", "In battle the card with lower POWER is destroyed; equal POWER destroys both (except with Grit). POWER given \"until the end of the battle\" goes when the battle ends; POWER with no time limit stays until the card leaves the field."],
    ja: ["パワー", "バトルで比べるアバターの強さ", "バトルではパワーが低い方が破壊され、同じなら両方破壊（根性を除く）。「バトル終了まで」のパワーはバトル終了で消え、期間の書かれていないものはカードが場を離れるまで残る。"],
  },
  "ตื่น": {
    en: ["Awake", "An Avatar's state: awake it can attack; attacking puts it to sleep", "An Avatar comes in awake. Ordering an attack puts it to sleep, and it wakes at the start of your next turn. Some abilities, such as Human shield, Unity and Backstab, use going to sleep as their cost."],
    ja: ["起き", "アバターの状態：起きていれば攻撃でき、攻撃すると寝になる", "アバターは起きた状態で場に出る。攻撃すると寝になり、自分の次のターン開始時に起きる。人間の盾・団結・背後討ちなど、寝になることをコストにする能力もある。"],
  },
  "การต่อสู้": {
    en: ["Battle", "When an Avatar attacks an Avatar, POWER is compared", "When an Avatar attacks an Avatar, or a Construct with POWER, a battle happens and the lower POWER is destroyed. Before the result, both sides can use React Magic and abilities that say \"when battling\"."],
    ja: ["バトル", "アバターがアバターを攻撃するとパワーを比べる", "アバターがアバターかパワーを持つコンストラクトを攻撃するとバトルになり、パワーが低い方が破壊される。結果の前に、両者ともリアクトマジックや「バトルするとき」の能力を使える。"],
  },
};
