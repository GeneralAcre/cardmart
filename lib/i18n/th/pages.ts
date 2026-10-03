// Messages, seller store, market overview, getting-started guide, onboarding.
export const PAGES: Record<string, string> = {
  // Messages
  "No conversations yet.": "ยังไม่มีการสนทนา",
  "Open a seller's profile or a listing and tap “Message Seller” to ask a question or negotiate a price.":
    "เปิดโปรไฟล์ผู้ขายหรือรายการขาย แล้วแตะ “ส่งข้อความหาผู้ขาย” เพื่อสอบถามหรือต่อรองราคา",
  "You:": "คุณ:",
  "No messages yet": "ยังไม่มีข้อความ",
  "Back to messages": "กลับไปที่ข้อความ",
  "Could not send message.": "ส่งข้อความไม่สำเร็จ",
  "Say hello — ask about the item's condition, shipping, or whether they'd take a lower price.":
    "ทักทายได้เลย — ถามเรื่องสภาพสินค้า การจัดส่ง หรือขอต่อราคา",
  "Write a message…": "พิมพ์ข้อความ…",

  // Store
  "{count} listed item": "ลงขาย {count} รายการ",
  "{count} listed items": "ลงขาย {count} รายการ",
  "{count} completed sale": "ขายสำเร็จ {count} ครั้ง",
  "{count} completed sales": "ขายสำเร็จ {count} ครั้ง",
  Listings: "รายการขาย",
  "Sold History": "ประวัติการขาย",
  Reviews: "รีวิว",
  "Nothing listed for sale right now.": "ยังไม่มีสินค้าวางขายในขณะนี้",
  "No completed sales yet.": "ยังไม่มีการขายสำเร็จ",
  "Sold {date}": "ขายเมื่อ {date}",
  "No reviews yet — they show up here after a completed sale.": "ยังไม่มีรีวิว — รีวิวจะแสดงที่นี่หลังการขายสำเร็จ",
  "bought “{name}”": "ซื้อ “{name}”",
  "{n} star": "{n} ดาว",
  "{n} stars": "{n} ดาว",

  // Market
  "Rankings, prices and the latest moves across CardMart. Every number comes from real listings and completed escrow sales. Medians are used so one unusual sale can't skew them.":
    "อันดับ ราคา และความเคลื่อนไหวล่าสุดใน CardMart ตัวเลขทั้งหมดมาจากรายการขายจริงและการขายผ่านเอสโครว์ที่สำเร็จ ใช้ค่ามัธยฐานเพื่อไม่ให้การขายที่ผิดปกติเพียงครั้งเดียวบิดเบือนตัวเลข",
  Rankings: "อันดับ",
  "Grade 10": "เกรด 10",
  "Grade 9": "เกรด 9",
  "BGS Pristine 10 Black Label — every sub-grade a perfect 10.": "BGS Pristine 10 Black Label — ทุกเกรดย่อยได้ 10 เต็ม",
  "PSA Gem Mint 10, BGS Pristine / Gem Mint 10 and CGC 10.": "PSA Gem Mint 10, BGS Pristine / Gem Mint 10 และ CGC 10",
  "Mint 9 and Gem Mint 9.5 slabs.": "สแลบ Mint 9 และ Gem Mint 9.5",
  "Ranked by value: the asking price if listed, otherwise the last real sale.": "จัดอันดับตามมูลค่า: ใช้ราคาตั้งหากลงขายอยู่ มิฉะนั้นใช้ราคาขายจริงครั้งล่าสุด",
  "No {tier} cards with a price yet.": "ยังไม่มีการ์ด {tier} ที่มีราคา",
  asking: "ราคาตั้ง",
  "last sale": "ขายล่าสุด",
  "Latest updates": "ความเคลื่อนไหวล่าสุด",
  "See every card's gains and losses on the Leaderboard": "ดูกำไรขาดทุนของการ์ดทุกใบได้ที่หน้าอันดับ",

  // Guide
  "Top up your wallet": "เติมเงินในกระเป๋า",
  "Every account comes with a Solana wallet. On Portfolio, choose Deposit to add test SOL (devnet). Prices are in THB and convert at {rate} THB per SOL.":
    "ทุกบัญชีมีกระเป๋าเงิน Solana ที่พอร์ต เลือกฝากเพื่อเติม SOL ทดสอบ (devnet) ราคาเป็นบาท และแปลงที่ {rate} บาทต่อ SOL",
  "Find a card": "หาการ์ด",
  "Browse the Marketplace, or check the Leaderboard for the biggest gainers, losers and new drops. Filter by grading company, grade, Black Label and price. The Compare Prices table puts several cards side by side.":
    "เลือกดูในตลาด หรือดูหน้าอันดับสำหรับการ์ดที่ราคาขึ้น ลง และมาใหม่ กรองตามบริษัทเกรด เกรด Black Label และราคา ตารางเปรียบเทียบราคาช่วยให้เทียบหลายใบพร้อมกัน",
  "Check the price": "เช็กราคา",
  "Each item page shows Price Insights and a comparison with CardMart's median sale, other listings of the same card, and eBay, TCGplayer, Beckett and PriceCharting.":
    "หน้าสินค้าแต่ละหน้าแสดงข้อมูลเชิงลึกด้านราคา และเปรียบเทียบกับราคาขายมัธยฐานของ CardMart รายการอื่นของการ์ดใบเดียวกัน และ eBay, TCGplayer, Beckett และ PriceCharting",
  "Buy with escrow": "ซื้อผ่านเอสโครว์",
  "Your payment is locked in an on-chain escrow, not paid straight to the seller. It's released only after our warehouse inspects the card and confirms it matches its certificate. Otherwise you're refunded.":
    "เงินของคุณถูกล็อกในเอสโครว์บนบล็อกเชน ไม่ได้จ่ายตรงให้ผู้ขาย และจะปล่อยให้ผู้ขายหลังคลังสินค้าตรวจการ์ดและยืนยันว่าตรงกับใบรับรองเท่านั้น มิฉะนั้นคุณจะได้เงินคืน",
  "Ship it or keep it in the vault": "จัดส่งหรือเก็บไว้ในห้องนิรภัย",
  "Have the card shipped to you, or keep it in our vault. Vaulted cards can be resold, auctioned or swapped instantly with no shipping, and redeemed to your door any time.":
    "ให้ส่งการ์ดถึงคุณ หรือเก็บไว้ในห้องนิรภัยของเรา การ์ดในห้องนิรภัยขายต่อ ประมูล หรือแลกได้ทันทีโดยไม่ต้องจัดส่ง และถอนส่งถึงบ้านได้ทุกเมื่อ",
  "List with Instant Verify": "ลงขายด้วยการยืนยันทันที",
  "Open Listing and follow the live-camera checklist (front, back, label, corners). Type a PSA cert number and the card details fill in automatically. Listing costs a flat {fee}.":
    "เปิดหน้าลงขายแล้วถ่ายภาพสดตามรายการ (หน้า หลัง ฉลาก มุม) พิมพ์หมายเลขใบรับรอง PSA แล้วรายละเอียดการ์ดจะกรอกให้อัตโนมัติ ค่าลงขายคงที่ {fee}",
  "Or send a raw card for grading": "หรือส่งการ์ดดิบไปเกรด",
  "Choose “Get it graded first” on Listing. We ship the card to PSA, BGS or CGC, pay their fee and mint it when it comes back — {price} all-in. Track it from the Grading tab on Portfolio.":
    "เลือก “ส่งเกรดก่อน” ที่หน้าลงขาย เราจะส่งการ์ดไปที่ PSA, BGS หรือ CGC จ่ายค่าเกรด และสร้างใบรับรองเมื่อการ์ดกลับมา — รวมทั้งหมด {price} ติดตามได้จากแท็บการเกรดในพอร์ต",
  "Get a digital twin": "รับใบรับรองดิจิทัล",
  "Each card is registered as a 1-of-1 token on Solana. Sign once to let the platform transfer it to the buyer when it sells.":
    "การ์ดแต่ละใบถูกลงทะเบียนเป็นโทเคนที่มีเพียงหนึ่งเดียวบน Solana ลงนามครั้งเดียวเพื่อให้แพลตฟอร์มโอนให้ผู้ซื้อเมื่อขายได้",
  "Price it, or auction it": "ตั้งราคา หรือเปิดประมูล",
  "Set a fixed price and change it any time, or start an auction (scheduled up to 30 days ahead, anti-sniping included). Buyers can also send you offers.":
    "ตั้งราคาคงที่และเปลี่ยนได้ทุกเมื่อ หรือเปิดประมูล (ตั้งเวลาล่วงหน้าได้ 30 วัน มีระบบกันการฉวยจังหวะ) ผู้ซื้อยังส่งข้อเสนอราคาให้คุณได้",
  "Ship to the warehouse when it sells": "ส่งไปคลังสินค้าเมื่อขายได้",
  "When a buyer pays, send the card to our warehouse ({shipping} shipping). Once it passes inspection, the escrow pays you. Cards already in the vault sell instantly.":
    "เมื่อผู้ซื้อชำระเงิน ส่งการ์ดมาที่คลังสินค้าของเรา (ค่าส่ง {shipping}) เมื่อผ่านการตรวจสอบ เอสโครว์จะจ่ายเงินให้คุณ การ์ดที่อยู่ในห้องนิรภัยแล้วขายได้ทันที",
  "Build trust": "สร้างความน่าเชื่อถือ",
  "Verify your identity on Portfolio to get an ID-verified badge. Every completed sale can earn a buyer review, and your rating shows on your store and listings.":
    "ยืนยันตัวตนที่พอร์ตเพื่อรับป้ายยืนยันตัวตน ทุกการขายที่สำเร็จจะได้รับรีวิวจากผู้ซื้อ และคะแนนจะแสดงในร้านและรายการขายของคุณ",
  "Make an offer": "ยื่นข้อเสนอราคา",
  "Not happy with the asking price? Offer your own. If the seller accepts, you check out at your price.":
    "ไม่พอใจราคาตั้ง? เสนอราคาของคุณเอง หากผู้ขายยอมรับ คุณจะชำระเงินที่ราคาที่เสนอ",
  "Browse listings": "ดูรายการขาย",
  "Your bid is locked in escrow when you place it and returned automatically if you're outbid, so every winning bid is real money. Minimum bids go up in 50 THB steps, and a bid in the last 5 minutes adds 5 more.":
    "เงินประมูลของคุณถูกล็อกในเอสโครว์ทันทีที่เสนอราคา และคืนอัตโนมัติหากมีคนเสนอสูงกว่า ทุกการชนะประมูลจึงมีเงินจริงรองรับ ราคาขั้นต่ำเพิ่มครั้งละ 50 บาท และการเสนอราคาใน 5 นาทีสุดท้ายจะขยายเวลาอีก 5 นาที",
  "See auctions": "ดูการประมูล",
  "Swap cards": "แลกการ์ด",
  "Trade a vaulted card for someone else's vaulted card, with cash on top either way. Cash waits in escrow until the swap completes.":
    "แลกการ์ดในห้องนิรภัยกับการ์ดในห้องนิรภัยของคนอื่น พร้อมเงินส่วนต่างได้ทั้งสองทาง เงินจะพักในเอสโครว์จนกว่าการแลกจะเสร็จ",
  "My trades": "การแลกของฉัน",
  "Card alerts": "การแจ้งเตือนการ์ด",
  "Looking for a specific card? Set an alert by name, grade and maximum price, optionally for trusted sellers only, and get notified when one is listed.":
    "ตามหาการ์ดใบไหนอยู่? ตั้งการแจ้งเตือนตามชื่อ เกรด และราคาสูงสุด เลือกเฉพาะผู้ขายที่น่าเชื่อถือได้ แล้วรับการแจ้งเตือนเมื่อมีการลงขาย",
  "My alerts": "การแจ้งเตือนของฉัน",
  "Welcome to CardMart": "ยินดีต้อนรับสู่ CardMart",
  "Your profile is set up. Here's a two-minute tour of how buying and selling works. You can come back to it any time from the menu under your avatar.":
    "ตั้งค่าโปรไฟล์เรียบร้อยแล้ว นี่คือทัวร์สองนาทีว่าการซื้อขายทำงานอย่างไร กลับมาดูได้ทุกเมื่อจากเมนูใต้รูปโปรไฟล์",
  "Getting started": "เริ่มต้นใช้งาน",
  "New to collecting graded cards? Pick a path below and follow the steps.": "เพิ่งเริ่มสะสมการ์ดเกรด? เลือกเส้นทางด้านล่างแล้วทำตามขั้นตอน",
  "I want to buy": "ฉันอยากซื้อ",
  "I want to sell": "ฉันอยากขาย",
  "Start browsing": "เริ่มเลือกดู",
  "List your first card": "ลงขายการ์ดใบแรก",
  "More ways to trade": "วิธีซื้อขายอื่นๆ",

  // Onboarding
  "Set up your profile": "ตั้งค่าโปรไฟล์",
  "One last step before you can browse, list, and trade — we need a few details so we can actually ship items to you.":
    "อีกขั้นตอนเดียวก่อนเริ่มเลือกดู ลงขาย และซื้อขาย — เราต้องการข้อมูลเล็กน้อยเพื่อจัดส่งสินค้าให้คุณได้",
  "Only used to send you physical items you buy, and to return items you sell.": "ใช้เพื่อส่งสินค้าที่คุณซื้อ และส่งคืนสินค้าที่คุณขายเท่านั้น",
  "Street, city, postal code — where we'll send physical items": "ถนน เมือง รหัสไปรษณีย์ — ที่อยู่สำหรับส่งสินค้า",
  "Saving…": "กำลังบันทึก…",
  "Complete Profile & Continue": "บันทึกโปรไฟล์และดำเนินการต่อ",
  "Sign-in failed": "เข้าสู่ระบบไม่สำเร็จ",
  "Log in with Solana wallet": "เข้าสู่ระบบด้วยกระเป๋า Solana",
  "Sign in with {wallet}": "เข้าสู่ระบบด้วย {wallet}",
  "your wallet": "กระเป๋าของคุณ",
  "Your wallet will ask you to sign a message to prove it's yours. It's free and doesn't send a transaction.":
    "กระเป๋าของคุณจะขอให้เซ็นข้อความเพื่อยืนยันว่าเป็นเจ้าของ ไม่มีค่าใช้จ่ายและไม่มีการส่งธุรกรรม",
  "Sign in": "เข้าสู่ระบบ",
};
