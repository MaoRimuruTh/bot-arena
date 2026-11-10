# BoT Arena

สนามซ้อมส่วนตัวสำหรับการ์ดเกม **Battle of Talingchan** — จัดเด็คก่อนซื้อจริง ดวลกับบอท/เพื่อน และให้ "ชิเอล" (Claude) ช่วยวิเคราะห์

- เว็บส่วนตัว ใช้ได้เฉพาะบัญชีที่เจ้าของอนุมัติ (`noindex`)
- **ไม่มีระบบซื้อขาย เติมเงิน หรือหารายได้ใดๆ** ทั้งสิ้น
- ข้อมูลและภาพการ์ดโหลดสดจากเว็บทางการ [bottcg.com](https://bottcg.com/cards) ไม่ได้เก็บสำเนาไว้ใน repo นี้ ลิขสิทธิ์การ์ด ภาพ และชื่อเกมเป็นของเจ้าของเกม (PASULOL / LION HOUSE) ใช้ส่วนตัวโดยได้รับอนุญาตจากทีมงาน
- กติกาอ้างอิง Rule Book 3.2

## โครงสร้าง
- Static site บน GitHub Pages (ES modules ไม่มี build step)
- Firebase Auth (Google) + Firestore — กฎความปลอดภัยอยู่ใน `firestore.rules`
- three.js r128 + GSAP สำหรับสนาม 3 มิติ
- ชิเอลเรียก Claude API ด้วย key ของผู้ใช้เอง เก็บเฉพาะใน localStorage ของเบราว์เซอร์

## เครดิตทรัพยากรฟรี
- Particle textures: [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) (CC0)
- Floor texture: [Poly Haven — rock_tile_floor](https://polyhaven.com/a/rock_tile_floor) (CC0)
- ฟอนต์: Chakra Petch, IBM Plex Sans Thai, JetBrains Mono (Google Fonts, OFL)
