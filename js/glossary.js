// The words on the cards and what they mean: a glossary written in our own words from the official Rule Book 3.2 (the page it
// comes from is noted on each entry), linked to the official FAQ, which is read live from the CDN like faq.js does.
// Tapping (or long-pressing) a keyword in any card text opens its entry; hovering shows the short meaning.
import { h, openSheet } from "./util.js?v=20261115012727";
import { loadFaq } from "./faq.js?v=20261115012727";
import { CARD_SOURCE } from "./config.js?v=20261115012727";

export const RULEBOOK_URL = "https://bottcg.com/rule";
// group: what kind of word it is · s: one line · l: the longer explanation · pg: the Rule Book page · al: other spellings
export const GROUPS = [["type", "ประเภทความสามารถ"], ["kw", "คีย์เวิร์ดบนการ์ด"], ["do", "คำสั่งในข้อความการ์ด"], ["card", "ประเภทการ์ดและสัญลักษณ์"], ["zone", "โซนบนสนาม"], ["play", "การเล่นและการต่อสู้"]];
export const GLOSS = [
  // ---- ability types
  { k: "ต่อเนื่อง", g: "type", pg: 6, s: "มีผลตลอดเวลาที่การ์ดใบนี้อยู่ในโซนที่ใช้ได้",
    l: "ไม่ต้องสั่ง ไม่ต้องรอจังหวะ ตราบใดที่การ์ดยังอยู่ในโซนที่ความสามารถทำงานได้ (เช่น Avatar อยู่บน Avatar Zone) ผลก็อยู่ตลอด พอการ์ดออกจากโซนนั้นผลก็หายทันที" },
  { k: "อัตโนมัติ", g: "type", pg: 6, al: ["อัติโนมัติ"], s: "ทำงานเองเมื่อเกิดเหตุการณ์ที่เขียนไว้",
    l: "ผู้เล่นไม่ได้เลือกกดใช้ เมื่อเงื่อนไขหลังคำว่า \"เมื่อ…\" เกิดขึ้น ความสามารถจะทำงานเอง ถ้าเกิดพร้อมกันหลายอย่าง เจ้าของการ์ดเป็นคนเรียงลำดับว่าอันไหนทำก่อน" },
  { k: "สั่งใช้", g: "type", pg: 7, s: "ผู้เล่นเลือกใช้เอง จ่ายค่าใช้จ่ายหน้าเครื่องหมาย : แล้วได้ผลหลัง :",
    l: "ใช้ได้เมื่ออยู่ในเงื่อนไขและโซนที่การ์ดระบุ ถ้าการ์ดไม่ได้บอกจังหวะ ใช้ได้เฉพาะ Main Phase ของเรา ถ้าบอกจังหวะไว้ (เช่น \"เมื่อ Avatar ต่อสู้\" หรือ \"ในเทิร์นใครก็ได้\") ใช้ได้ตามจังหวะนั้น ข้อความก่อน : คือค่าใช้จ่ายหรือเงื่อนไข หลัง : คือผล" },
  { k: "เทิร์นละครั้ง", g: "type", pg: 6, s: "ใช้หรือทำงานได้ 1 ครั้งต่อเทิร์น",
    l: "นับแยกต่อการ์ดแต่ละใบ แม้ Avatar จะถูกย้ายไป Magic Zone แล้วอัญเชิญกลับมาใหม่ในเทิร์นเดียวกัน ก็ยังใช้ซ้ำไม่ได้ ถ้าเขียนว่า \"#เทิร์นละ 1 ครั้ง\" ที่ชื่อ จะนับรวมทุกใบที่ชื่อเดียวกัน" },
  { k: "เลือกปฏิบัติ", g: "type", pg: 9, s: "เลือกทำข้อใดข้อหนึ่งจากรายการ",
    l: "ตอนใช้การ์ดให้เลือกหนึ่งข้อจากรายการที่มีเลขกำกับ บางใบอนุญาตให้ทำได้หลายข้อเมื่อครบเงื่อนไขที่เขียนไว้" },
  // ---- keywords
  { k: "จุติ", g: "kw", pg: 6, s: "ทำงานเมื่อ Avatar ใบนี้ถูกอัญเชิญลงสนามแบบจ่าย Cost",
    l: "ต้องเป็นการอัญเชิญที่ผู้เล่นจ่าย Cost เอง หรือการ์ดที่บอกไว้ชัดว่า \"อัญเชิญแบบจุติ\" เท่านั้น ถ้า Avatar ถูกอัญเชิญฟรีด้วยความสามารถอื่น จุติจะไม่ทำงาน" },
  { k: "คำสั่งเสีย", g: "kw", pg: 6, s: "ทำงานหลังจาก Avatar ใบนี้ถูกทำลาย",
    l: "เกิดหลังจาก Avatar ถูกทำลายและลงนรกไปแล้ว ไม่ว่าจะถูกทำลายจากการต่อสู้หรือจากความสามารถการ์ด แต่ถ้าออกจากสนามด้วยวิธีอื่น เช่น ถูกเนรเทศ ถูกนำขึ้นมือ หรือถูกส่งลงนรกโดยไม่ได้ถูกทำลาย จะไม่ทำงาน" },
  { k: "พอดี", g: "kw", pg: 6, s: "ได้ความสามารถเมื่ออัญเชิญด้วย GEM พอดีกับ Cost",
    l: "ถ้าทิ้งการ์ดจ่าย GEM รวมกันเท่ากับ Cost ของ Avatar พอดี Avatar จะได้ความสามารถที่ตามหลังคำว่าพอดี ถ้าจ่ายเกินจะไม่ได้" },
  { k: "โล่มนุษย์", g: "kw", pg: 6, s: "เมื่ออีกฝ่ายโจมตี เปลี่ยนใบนี้จากตื่นเป็นนอน แล้วรับการโจมตีแทน",
    l: "ใช้ได้ตอนฝ่ายตรงข้ามเลือกเป้าหมายแล้ว Avatar ที่มีโล่มนุษย์ต้องตื่นอยู่บน Avatar Zone เปลี่ยนเป็นนอนแล้วกลายเป็นเป้าหมายใหม่ ใช้กันการโจมตีแบบเตะไข่ได้ด้วย" },
  { k: "สามัคคี", g: "kw", pg: 6, s: "เปลี่ยนใบนี้เป็นนอน แล้วเอา POWER ไปบวกให้ Avatar เราที่โจมตี",
    l: "ตอนเราโจมตี Avatar ที่มีสามัคคีและตื่นอยู่เปลี่ยนเป็นนอน แล้ว POWER ของมันไปเพิ่มให้ตัวที่โจมตีจนจบการต่อสู้ (หรือจนจบการโจมตีถ้าตี LIFE)" },
  { k: "แทงหลัง", g: "kw", pg: 7, s: "ช่วยฝ่ายตรงข้ามตอนถูกตี: +1 ให้ผู้โจมตี แต่ถ้าสีต่างกัน ผู้โจมตีถูกทำลายหลังจบการต่อสู้",
    l: "ใบนี้เปลี่ยนจากตื่นเป็นนอน เพิ่ม POWER ให้ผู้โจมตีของอีกฝ่าย แล้วถ้า Avatar ที่โจมตีมีสีต่างจากใบนี้ ผู้โจมตีถูกทำลายเมื่อจบการต่อสู้" },
  { k: "ลูกฮึด", g: "kw", pg: 7, s: "สู้กับ Avatar ที่ POWER เท่ากันแล้วชนะ",
    l: "ปกติ POWER เท่ากันจะถูกทำลายทั้งคู่ แต่ใบที่มีลูกฮึดจะชนะ ถ้าทั้งสองใบมีลูกฮึดเหมือนกัน ก็ถูกทำลายทั้งคู่ตามปกติ" },
  { k: "เตะไข่", g: "kw", pg: 6, s: "โจมตี LIFE ได้ทันทีแม้อีกฝ่ายมี Avatar อยู่",
    l: "ปกติต้องโจมตี Avatar ก่อนถ้าอีกฝ่ายมี Avatar บน Avatar Zone แต่ใบที่มีเตะไข่ข้ามไปตี LIFE ได้เลย ฝ่ายป้องกันยังใช้โล่มนุษย์กันได้" },
  { k: "Link", g: "kw", al: ["คู่หู"], s: "ได้ความสามารถคู่หูเมื่ออยู่ในสถานะคู่หูกับการ์ดที่ระบุ",
    l: "การ์ดที่มี [Link …] จะได้ความสามารถคู่หูเมื่อเข้าสู่สถานะคู่หูตามที่การ์ดบอก ถ้าออกจากสถานะนั้น ความสามารถคู่หูก็หายไป" },
  // ---- things card text tells you to do
  { k: "สอดแนม", g: "do", pg: 6, s: "เปิดดูการ์ดบนสุดของ Deck ตามจำนวน",
    l: "เปิดดูการ์ดจากบนสุดของ Deck เราตามจำนวน แล้วทำตามที่การ์ดบอก (เช่นนำบางใบขึ้นมือ) การ์ดที่เหลือวางกลับตามที่เขียนไว้ ถ้าการ์ดไม่ได้บอกว่า Deck ของใคร หมายถึง Deck เราเสมอ" },
  { k: "ธรณีสูบ", g: "do", pg: 6, s: "ส่งการ์ดบนสุดของ Deck ลงนรกตามจำนวน",
    l: "นำการ์ดจากบนสุดของ Deck ลงนรกตามจำนวนที่บอก ถ้าไม่ได้บอกว่า Deck ของใคร หมายถึง Deck เรา ถ้า Deck หมดเมื่อไรจะแพ้ทันที จึงต้องระวังเวลาใช้เป็นค่าใช้จ่าย" },
  { k: "เนรเทศ", g: "do", pg: 3, s: "ส่งการ์ดไปมิติมืด ออกจากเกมไปเลย",
    l: "การ์ดที่ถูกเนรเทศไปอยู่ในมิติมืด (Dark Dimension Zone) ไม่ใช่นรก จึงไม่นับเป็นการถูกทำลาย และคำสั่งเสียไม่ทำงาน" },
  { k: "เซ่นไหว้", g: "do", s: "ทำลาย Avatar ของเราลงนรกเป็นค่าใช้จ่าย",
    l: "จ่ายค่าใช้จ่ายด้วยการทำลาย Avatar บน Avatar Zone ของเราตามที่การ์ดบอก Avatar นั้นลงนรก และนับว่าถูกทำลาย" },
  { k: "สวมใส่", g: "do", pg: 9, s: "ติด Modification Magic ไว้กับ Avatar",
    l: "Modification Magic จะติดอยู่กับ Avatar หนึ่งใบเพื่อเพิ่ม POWER หรือความสามารถ ถ้า Avatar นั้นออกจากสนาม หรือไม่ตรงเงื่อนไขการสวมใส่อีกต่อไป การ์ดที่สวมอยู่ลงนรก" },
  { k: "เปลี่ยนการควบคุม", g: "do", pg: 8, s: "ย้าย Avatar ไปอยู่ฝั่งผู้เล่นอีกคน",
    l: "Avatar ย้ายไป Avatar Zone ของอีกฝ่ายและอยู่ใต้การควบคุมของเขา ไม่นับเป็นการออกจากสนาม ถ้าการ์ดบอกว่า \"จนจบเทิร์น\" จะกลับไปหาเจ้าของเมื่อจบเทิร์น" },
  { k: "แสดง", g: "do", s: "เปิดการ์ดบนมือให้อีกฝ่ายดู",
    l: "นำการ์ดบนมือมาเปิดให้เห็นเป็นค่าใช้จ่ายหรือเงื่อนไข แล้วเก็บกลับขึ้นมือ ไม่ได้ทิ้งการ์ดนั้น" },
  { k: "สาหัส", g: "play", s: "LIFE ถูกหงายครบแล้ว ถ้าถูกตี LIFE อีกครั้งจะแพ้",
    l: "เมื่อ LIFE Card ทั้งหมดถูกหงายแล้ว ผู้เล่นอยู่ในสถานะสาหัส ถ้าถูกโจมตี LIFE อีกหนึ่งครั้งจะแพ้" },
  // ---- card kinds and marks
  { k: "Avatar", g: "card", pg: 2, s: "การ์ดตัวละครที่ลงสนามไปโจมตีและป้องกัน",
    l: "อัญเชิญลง Avatar Zone โดยทิ้งการ์ดจ่าย GEM ให้ครบ Cost มีได้สูงสุด 4 ใบ (รวม Token แล้วไม่เกิน 6) ลงมาในสภาพตื่น จึงสั่งโจมตีได้ใน Battle Phase ของเทิร์นนั้น" },
  { k: "Token", g: "card", s: "ตัวแทน Avatar ที่เกิดจากความสามารถการ์ด",
    l: "ใช้กฎเดียวกับ Avatar ทุกอย่าง ทั้งการโจมตีและการต่อสู้ ความสามารถที่มีผลกับ Avatar ก็มีผลกับ Token แต่เมื่อออกจาก Avatar Zone Token จะหายออกจากเกม Avatar Zone มี Avatar ได้ 4 ใบ รวม Token แล้วไม่เกิน 6" },
  { k: "Construct", g: "card", pg: 2, s: "การ์ดสิ่งก่อสร้างที่วางใน Construct Zone",
    l: "ก่อสร้างลง Construct Zone ด้วยการจ่าย GEM เหมือน Avatar มีได้สูงสุด 3 ใบและชื่อต้องไม่ซ้ำกัน ใบที่มี POWER ถูกโจมตีและต่อสู้ได้" },
  { k: "Normal Magic", g: "card", pg: 9, al: ["Magic"], s: "Magic ทั่วไป ใช้ใน Main Phase เรา แล้วลงนรก",
    l: "ใช้ได้ใน Main Phase ของเรา ผลเกิดแล้วการ์ดลงนรก Magic แต่ละประเภทใช้ได้ประเภทละ 1 ครั้งต่อเทิร์น" },
  { k: "Modification Magic", g: "card", pg: 9, s: "Magic ที่สวมใส่ให้ Avatar",
    l: "สวมใส่ให้ Avatar ได้ 1 ใบต่อ Avatar หนึ่งตัว เพิ่ม POWER หรือความสามารถ ตรวจเงื่อนไขการสวมใส่ตลอดเวลา" },
  { k: "React Magic", g: "card", pg: 9, al: ["React"], s: "Magic ที่ใช้ตอบโต้ได้แม้ไม่ใช่เทิร์นเรา",
    l: "ใช้ได้ในจังหวะที่การ์ดระบุ เช่นตอนถูกโจมตี ถ้าการ์ดไม่ได้ระบุจังหวะ ใช้ได้ตอนที่อีกฝ่ายทำ Action หรือก่อนเข้า Battle Phase และต้องไม่มีความสามารถอื่นกำลังทำงานอยู่ ใช้ได้ 1 ใบต่อเทิร์น" },
  { k: "Land Magic", g: "card", pg: 9, al: ["Land"], s: "Magic สนามที่มีผลกับทุกคน มีได้ทีละใบ",
    l: "วางใน Land Magic Zone ซึ่งใช้ร่วมกันทั้งสองฝ่าย มีผลกับผู้เล่นทุกคน คนที่ลงใบนั้นนับเป็นเจ้าของ ถ้ามีคนลงใบใหม่ ใบเก่าจะลงนรกของเจ้าของ" },
  { k: "LIFE Card", g: "card", pg: 2, al: ["LIFE"], s: "การ์ดชีวิต 5 ใบที่ถูกหงายเมื่อโดนโจมตี",
    l: "เมื่อถูกโจมตี LIFE จะหงาย LIFE Card ทีละใบ บางใบมีความสามารถตอนถูกหงาย เมื่อหงายครบแล้วจะอยู่ในสถานะสาหัส ถ้าถูกตีอีกครั้งจะแพ้" },
  { k: "Only #1", g: "card", pg: 5, al: ["only", "Only"], s: "ใส่ได้ 1 ใบต่อเด็ค",
    l: "การ์ดที่มีสัญลักษณ์ Only #1 ใส่ได้มากสุด 1 ใบต่อ Deck และใน Deck หนึ่งใส่การ์ด Only #1 ได้แค่ใบเดียว ไม่ว่าจะเป็นประเภทอะไร" },
  { k: "ลำเอียง", g: "card", pg: 1, s: "การ์ดที่ใส่ใน Deck ที่ใช้แข่งขันทางการไม่ได้",
    l: "การ์ดที่มีสัญลักษณ์ลำเอียงยังเล่นกับเพื่อนหรือกับบอทได้ แต่ใช้ใน Deck สำหรับแข่งขันทั่วไปไม่ได้ (ทัวร์ในกลุ่มเพื่อนของเว็บนี้ก็ไม่รับ)" },
  { k: "โดนใจ", g: "card", s: "การ์ดคอลแลบที่ใช้แข่งได้",
    l: "การ์ดพิเศษจากการร่วมมือกับแบรนด์อื่น ใส่ใน Deck แข่งได้ตามปกติ" },
  { k: "Symbol", g: "card", al: ["symbol"], s: "เผ่าหรือกลุ่มของการ์ด เช่น {เทพ} {นรก}",
    l: "การ์ดหลายใบอ้างถึง Symbol เพื่อเลือกเป้าหมายหรือนับจำนวน ตัวอย่างเช่น \"Avatar {Symbol เทพ}\" หมายถึง Avatar ที่มี Symbol เทพ" },
  // ---- zones
  { k: "Avatar Zone", g: "zone", pg: 2, s: "ที่วาง Avatar ที่ใช้โจมตีและป้องกัน", l: "มี Avatar ได้สูงสุด 4 ใบ รวม Token แล้วไม่เกิน 6 ใบ Avatar ที่นี่โจมตีได้และเป็นเป้าหมายการโจมตีได้" },
  { k: "Magic Zone", g: "zone", pg: 2, s: "ที่วาง Magic ที่อยู่ค้างบนสนาม และ Avatar ที่ถูกย้ายมา",
    l: "Avatar ที่ถูกย้ายมาที่นี่ยังนับเป็น Avatar มี POWER แต่โจมตีไม่ได้ ใช้ความสามารถไม่ได้ (ยกเว้นการ์ดบอกไว้) และถูกเลือกเป็นเป้าหมายการโจมตีไม่ได้ ถ้าถูกอัญเชิญกลับไป Avatar Zone จะนับเป็นใบใหม่ ค่าที่เคยเพิ่มไว้หายหมด" },
  { k: "นรก", g: "zone", pg: 3, al: ["Hell"], s: "กองทิ้งของแต่ละฝ่าย",
    l: "การ์ดที่ถูกทำลาย ถูกใช้ไปแล้ว หรือถูกธรณีสูบมาอยู่ที่นี่ ทุกคนดูได้ หลายความสามารถนับหรือดึงการ์ดจากนรก ถ้าการ์ดไม่ได้บอกว่านรกของใคร ตาม FAQ ทางการจะนับทั้งสองฝ่าย" },
  { k: "มิติมืด", g: "zone", pg: 3, al: ["Dark Dimension"], s: "ที่อยู่ของการ์ดที่ถูกเนรเทศ", l: "การ์ดที่ถูกเนรเทศมาอยู่ที่นี่ ถือว่าออกจากเกมแล้ว ไม่ได้อยู่ในนรก" },
  { k: "Land Magic Zone", g: "zone", pg: 2, s: "ช่องกลางสนามสำหรับ Land Magic ใช้ร่วมกันทั้งสองฝ่าย", l: "มี Land Magic ได้แค่ 1 ใบ ใบใหม่จะแทนที่ใบเก่า" },
  // ---- play
  { k: "Cost", g: "play", pg: 6, al: ["GEM"], s: "ค่าที่ต้องจ่ายเพื่ออัญเชิญ จ่ายด้วยการทิ้งการ์ดที่มี GEM",
    l: "ทิ้งการ์ดจากมือให้ GEM รวมกันถึง Cost การ์ดที่ GEM เป็น 0 ใช้จ่ายไม่ได้ GEM มีสีใช้จ่ายได้เฉพาะ Avatar สีเดียวกัน ถ้าจ่ายเกินทำได้ แต่ห้ามทิ้งการ์ดเกินที่จำเป็น Avatar ที่ Cost 0 อัญเชิญได้เลย" },
  { k: "POWER", g: "play", s: "พลังของ Avatar ใช้เทียบตอนต่อสู้",
    l: "ตอนต่อสู้ ใบที่ POWER ต่ำกว่าถูกทำลาย ถ้าเท่ากันถูกทำลายทั้งคู่ (ยกเว้นลูกฮึด) POWER ที่ \"จนจบการต่อสู้\" หายเมื่อการต่อสู้จบ ส่วนที่ไม่ได้ระบุช่วงเวลาจะติดอยู่ถาวรจนการ์ดออกจากสนาม" },
  { k: "ตื่น", g: "play", al: ["นอน"], s: "สภาพของ Avatar: ตื่นอยู่จึงโจมตีได้ สั่งโจมตีแล้วเปลี่ยนเป็นนอน",
    l: "Avatar ลงสนามในสภาพตื่น พอสั่งโจมตีจะเปลี่ยนเป็นนอน และกลับมาตื่นตอนเริ่มเทิร์นถัดไปของเรา ความสามารถบางอย่าง เช่น โล่มนุษย์ สามัคคี แทงหลัง ใช้การเปลี่ยนเป็นนอนเป็นค่าใช้จ่าย" },
  { k: "การต่อสู้", g: "play", al: ["ต่อสู้"], s: "เมื่อ Avatar โจมตี Avatar ให้เทียบ POWER",
    l: "เมื่อ Avatar โจมตี Avatar หรือ Construct ที่มี POWER จะเกิดการต่อสู้ ใบที่ POWER ต่ำกว่าถูกทำลาย ก่อนเทียบผล ทั้งสองฝ่ายใช้ React Magic และความสามารถที่บอกว่า \"เมื่อต่อสู้\" ได้" },
];
const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
const BY = new Map(); for (const e of GLOSS) for (const k of [e.k, ...(e.al || [])]) BY.set(norm(k), e);
export const glossFor = (k) => BY.get(norm(k)) || BY.get(norm(String(k || "").replace(/^\{?\s*|\s*\}?$/g, ""))) || null;

// the official FAQ answers that mention a word (search in the card name, question and answer)
export async function faqSearch(q, max = 400) {
  const m = await loadFaq(); const words = norm(q).split(" ").filter(Boolean); if (!words.length) return [];
  const out = [];
  for (const [name, qs] of m) for (const x of qs) {
    const t = norm(name + " " + x.question + " " + (x.answer || "")); if (words.every((w) => t.includes(w))) { out.push({ name, q: x }); if (out.length >= max) return out; }
  }
  return out;
}
// mark every match of the query inside a text
export function marked(text, q) {
  const s = String(text || ""); const words = norm(q).split(" ").filter((w) => w.length > 0); if (!words.length) return [s];
  const re = new RegExp("(" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi"); const out = []; let last = 0, m;
  while ((m = re.exec(s))) { if (m.index > last) out.push(s.slice(last, m.index)); out.push(h("mark", null, m[0])); last = m.index + m[0].length; if (!m[0].length) re.lastIndex++; }
  if (last < s.length) out.push(s.slice(last)); return out;
}
// one entry as a block (in the page and in the sheet)
export function glossEntry(e, { onFaq } = {}) {
  const faqN = h("span", { class: "tiny muted" });
  faqSearch(e.k, 200).then((r) => { faqN.textContent = r.length ? `FAQ ที่พูดถึงคำนี้ ${r.length >= 200 ? "200+" : r.length} ข้อ` : "ยังไม่มี FAQ ที่พูดถึงคำนี้"; }).catch(() => { faqN.textContent = ""; });
  return h("div", { class: "gl-entry" },
    h("p", { class: "gl-s" }, e.s), h("p", { class: "gl-l small" }, e.l),
    h("div", { class: "gl-meta row" }, h("span", { class: "tiny muted" }, e.pg ? `อ้างอิง Rule Book 3.2 หน้า ${e.pg}` : "สรุปจากข้อความบนการ์ดและ FAQ"),
      onFaq ? h("button", { class: "btn sm", onclick: () => onFaq(e.k) }, "ดู FAQ ที่เกี่ยวข้อง") : null, faqN));
}
// a sheet for one word: opened from card text anywhere in the app, and from the game menu (with a search box)
export function openGloss(word) {
  const e = glossFor(word); if (!e) return false;
  openSheet((api) => [glossEntry(e, { onFaq: (k) => { api.close(); location.hash = "#rules/q/" + encodeURIComponent(k); } }),
    h("div", { class: "row" }, h("a", { class: "btn sm", href: "#rules/k/" + encodeURIComponent(e.k), onclick: () => api.close() }, "ดูคำศัพท์ทั้งหมด"))], { title: e.k, sub: GROUPS.find(([g]) => g === e.g)[1] });
  return true;
}
// the glossary in a sheet, searchable (used inside a game, where leaving the table is not wanted)
export function openGlossSheet() {
  openSheet(() => {
    const list = h("div", { class: "stack", style: "gap:10px" }); const inp = h("input", { type: "search", placeholder: "ค้นคำ เช่น จุติ ธรณีสูบ React", "aria-label": "ค้นหาคำศัพท์", class: "gl-search" });
    const fill = () => { const q = norm(inp.value); const es = GLOSS.filter((e) => !q || norm(e.k + " " + (e.al || []).join(" ") + " " + e.s + " " + e.l).includes(q));
      list.replaceChildren(...(es.length ? es.map((e) => h("details", { class: "gl-item" }, h("summary", null, h("b", null, e.k), h("span", { class: "small muted" }, " · " + e.s)), glossEntry(e))) : [h("div", { class: "muted small" }, "ไม่พบคำนี้")])); };
    inp.addEventListener("input", fill); fill(); setTimeout(() => inp.focus({ preventScroll: true }), 50);
    return [inp, list, h("a", { class: "tiny", href: RULEBOOK_URL, target: "_blank", rel: "noopener noreferrer" }, "Rule Book ฉบับทางการ ↗")];
  }, { title: "คำศัพท์บนการ์ด", sub: "แตะคำในข้อความการ์ดเพื่อเปิดคำอธิบายได้ทุกที่" });
}
// tap or long-press a keyword in card text (anywhere: card sheets, the game, the library) to open its entry
const KW_SEL = ".fx .kw, .fx .tg, .fx .sy.mk, .kwgloss dt";
const wordOf = (el) => (el.textContent || "").replace(/^◆\s*/, "").trim();
if (typeof document !== "undefined") {
  let pressT = 0, pressed = null;
  document.addEventListener("click", (ev) => {
    const el = ev.target && ev.target.closest && ev.target.closest(KW_SEL); if (!el || !glossFor(wordOf(el))) return;
    if (pressed === el) { pressed = null; ev.preventDefault(); ev.stopPropagation(); return; } // the long-press already opened it
    ev.preventDefault(); ev.stopPropagation(); openGloss(wordOf(el));
  }, true);
  document.addEventListener("pointerdown", (ev) => {
    const el = ev.target && ev.target.closest && ev.target.closest(KW_SEL); if (!el || ev.pointerType === "mouse" || !glossFor(wordOf(el))) return;
    clearTimeout(pressT); pressT = setTimeout(() => { pressed = el; openGloss(wordOf(el)); }, 480);
  }, true);
  for (const t of ["pointerup", "pointercancel", "pointermove"]) document.addEventListener(t, (ev) => { if (t !== "pointermove" || Math.abs(ev.movementX) + Math.abs(ev.movementY) > 6) clearTimeout(pressT); }, true);
  document.addEventListener("keydown", (ev) => { if (ev.key !== "Enter" && ev.key !== " ") return; const el = ev.target && ev.target.closest && ev.target.closest(KW_SEL); if (el && glossFor(wordOf(el))) { ev.preventDefault(); openGloss(wordOf(el)); } });
}
export const FAQ_PAGE = CARD_SOURCE.faqPage;
