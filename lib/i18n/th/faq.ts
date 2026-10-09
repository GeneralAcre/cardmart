// FAQ page (app/(app)/faq/page.tsx).
export const FAQ: Record<string, string> = {
  FAQ: "คำถามที่พบบ่อย",
  "Questions & answers": "คำถามและคำตอบ",
  "How prices are worked out, where your money goes, and what happens at each step.":
    "ราคาคำนวณอย่างไร เงินของคุณไปอยู่ที่ไหน และแต่ละขั้นตอนเกิดอะไรขึ้นบ้าง",
  "New here? Start with the guide.": "เพิ่งเริ่มใช้? เริ่มจากคู่มือได้เลย",

  "Prices and data": "ราคาและข้อมูล",
  "Where does the market price come from?": "ราคาตลาดมาจากไหน?",
  "From real listings and sales only. First choice is the median asking price of live eBay listings for the exact same card in the exact same grade. If eBay has no match, it's the median of completed CardMart sales in that grade. If neither exists, no market price is shown. Ungraded cards work the same way, priced from eBay listings of the ungraded card. A price never comes from a different grade.":
    "มาจากประกาศขายและการขายจริงเท่านั้น อันดับแรกคือค่ามัธยฐานของราคาตั้งขายบน eBay ที่ยังเปิดอยู่ สำหรับการ์ดใบเดียวกันในเกรดเดียวกันทุกประการ ถ้า eBay ไม่มีรายการที่ตรงกัน จะใช้ค่ามัธยฐานของการขายที่สำเร็จบน CardMart ในเกรดนั้น ถ้าไม่มีทั้งสองอย่าง จะไม่แสดงราคาตลาด การ์ดที่ไม่ได้เกรดก็ใช้วิธีเดียวกัน โดยอิงจากประกาศบน eBay ของการ์ดที่ไม่ได้เกรด ราคาไม่เคยมาจากเกรดอื่น",
  "Why eBay asking prices and not sold prices?": "ทำไมใช้ราคาตั้งขายบน eBay ไม่ใช่ราคาที่ขายได้จริง?",
  "eBay only shares sold-price data with approved partners, so the price we can fetch is what sellers are asking right now. It's always labeled as an asking price. To see what the card actually sold for, use the \"eBay sold listings\" link on the item page, which opens eBay's own sold search.":
    "eBay เปิดข้อมูลราคาที่ขายได้จริงให้เฉพาะพาร์ตเนอร์ที่ได้รับอนุมัติ ราคาที่เราดึงได้จึงเป็นราคาที่ผู้ขายตั้งไว้ตอนนี้ และจะระบุว่าเป็นราคาตั้งขายเสมอ หากต้องการดูราคาที่ขายได้จริง ให้กดลิงก์ \"รายการที่ขายแล้วบน eBay\" ในหน้าสินค้า ซึ่งจะเปิดหน้าค้นหารายการที่ขายแล้วของ eBay โดยตรง",
  "How do you know an eBay listing is the same card?": "รู้ได้อย่างไรว่าประกาศบน eBay เป็นการ์ดใบเดียวกัน?",
  "A listing only counts if its title has the card's name, set and card number, the same grading company and grade (or no grader for a raw card), and the same language. Japanese and English prints are kept apart, and Black Label is matched separately. Lots, proxies, reprints and customs are thrown out. We'd rather show a few real matches than many look-alikes.":
    "ประกาศจะถูกนับก็ต่อเมื่อชื่อประกาศมีชื่อการ์ด ชุด และหมายเลขการ์ด บริษัทเกรดและเกรดเดียวกัน (หรือไม่มีบริษัทเกรดสำหรับการ์ดที่ไม่ได้เกรด) และภาษาเดียวกัน การ์ดภาษาญี่ปุ่นกับภาษาอังกฤษแยกกัน และ Black Label จับคู่แยกต่างหาก รายการแบบล็อต การ์ดปลอม การ์ดพิมพ์ซ้ำ และการ์ดทำเองจะถูกตัดออก เราเลือกแสดงรายการที่ตรงจริงไม่กี่รายการ ดีกว่าแสดงรายการที่แค่คล้ายกันจำนวนมาก",
  "Why does my card have no market price?": "ทำไมการ์ดของฉันไม่มีราคาตลาด?",
  "Nobody is selling that exact card in that grade on eBay right now, and it hasn't sold on CardMart in that grade yet. Rare cards and unusual grades often have no match. The price shows up once there's real data.":
    "ตอนนี้ไม่มีใครขายการ์ดใบนี้ในเกรดนี้บน eBay และยังไม่เคยขายได้บน CardMart ในเกรดนี้ การ์ดหายากและเกรดที่ไม่ค่อยพบมักไม่มีรายการที่ตรงกัน ราคาจะแสดงเมื่อมีข้อมูลจริง",
  "Why do some prices have \"≈\" in front?": "ทำไมบางราคามีเครื่องหมาย \"≈\" นำหน้า?",
  "eBay and TCGplayer prices are in US dollars. We convert them at a fixed rate of about {rate} THB per USD so everything sits on one baht scale. It's only for comparing and is never used for payments.":
    "ราคาจาก eBay และ TCGplayer เป็นดอลลาร์สหรัฐ เราแปลงด้วยอัตราคงที่ประมาณ {rate} บาทต่อดอลลาร์ เพื่อให้เทียบกันในหน่วยบาทได้ ใช้เพื่อเปรียบเทียบเท่านั้น ไม่เคยใช้ในการชำระเงิน",
  "What does \"a rough guide\" mean next to a price comparison?": "\"ใช้เป็นแนวทางคร่าว ๆ\" ข้างการเปรียบเทียบราคาหมายความว่าอะไร?",
  "The comparison rests on fewer than 3 prices. One or two listings can be far off the real market, so take it as a hint, not a verdict.":
    "การเปรียบเทียบนั้นอิงจากราคาไม่ถึง 3 รายการ ประกาศเพียงหนึ่งหรือสองรายการอาจห่างจากราคาตลาดจริงมาก จึงควรดูเป็นแนวทาง ไม่ใช่ข้อสรุป",
  "What's the CardMart median sale?": "ค่ามัธยฐานการขายของ CardMart คืออะไร?",
  "The middle price of completed CardMart sales of the exact same card and grade over the last 90 days. We use the median rather than the average so one unusually high or low sale can't drag it.":
    "ราคากลางของการขายที่สำเร็จบน CardMart สำหรับการ์ดใบเดียวกันในเกรดเดียวกันในช่วง 90 วันที่ผ่านมา เราใช้ค่ามัธยฐานแทนค่าเฉลี่ย เพื่อไม่ให้การขายที่สูงหรือต่ำผิดปกติเพียงครั้งเดียวดึงราคาไป",
  "What is the TCGplayer price?": "ราคา TCGplayer คืออะไร?",
  "TCGplayer's market price for the ungraded card, shown next to eBay's ungraded price as a second opinion. TCGplayer only covers trading card games.":
    "ราคาตลาดของ TCGplayer สำหรับการ์ดที่ไม่ได้เกรด แสดงคู่กับราคาการ์ดที่ไม่ได้เกรดจาก eBay เพื่อเป็นอีกหนึ่งความเห็น TCGplayer มีเฉพาะการ์ดเกมเท่านั้น",
  "What does the Market Price History chart show?": "กราฟประวัติราคาตลาดแสดงอะไร?",
  "The market price saved once a day: eBay's median asking price for that card and grade, or CardMart sales when eBay has none. It never shows the seller's own asking price, so a seller can't move the chart by changing their price.":
    "ราคาตลาดที่บันทึกวันละครั้ง คือค่ามัธยฐานราคาตั้งขายบน eBay ของการ์ดและเกรดนั้น หรือราคาขายบน CardMart เมื่อ eBay ไม่มีข้อมูล กราฟไม่เคยแสดงราคาที่ผู้ขายตั้งเอง ผู้ขายจึงขยับกราฟด้วยการเปลี่ยนราคาไม่ได้",
  "How fresh are the prices?": "ราคาอัปเดตบ่อยแค่ไหน?",
  "eBay prices are fetched live and reused for up to 10 minutes. Every card for sale also gets its market price saved once a day for the history chart.":
    "ราคาจาก eBay ดึงแบบสดและใช้ซ้ำได้นานสุด 10 นาที การ์ดทุกใบที่วางขายจะถูกบันทึกราคาตลาดวันละครั้งสำหรับกราฟประวัติราคา",
  "How are Leaderboard gainers and losers worked out?": "การจัดอันดับราคาขึ้นและลงบน Leaderboard คำนวณอย่างไร?",
  "By how much each listing's asking price changed over 24 hours, 7 days or 30 days, from the listing's own price history. A listing with no earlier price in that window shows no change instead of 0%.":
    "คำนวณจากการเปลี่ยนแปลงของราคาตั้งขายในช่วง 24 ชั่วโมง 7 วัน หรือ 30 วัน ตามประวัติราคาของประกาศนั้นเอง ประกาศที่ไม่มีราคาก่อนหน้าในช่วงนั้นจะไม่แสดงการเปลี่ยนแปลง แทนที่จะแสดง 0%",

  Buying: "การซื้อ",
  "Is this real money?": "ใช้เงินจริงหรือไม่?",
  "Not yet. CardMart runs on Solana devnet for now, so payments use test SOL, which has no real value. We will move to real payments on Solana mainnet. Until then, you can add test SOL from Portfolio with Deposit.":
    "ยังไม่ใช่ ตอนนี้ CardMart ทำงานบน Solana devnet การชำระเงินจึงใช้ SOL ทดสอบซึ่งไม่มีมูลค่าจริง เราจะย้ายไปใช้การชำระเงินจริงบน Solana mainnet แน่นอน ระหว่างนี้คุณเติม SOL ทดสอบได้ที่หน้าพอร์ตโฟลิโอด้วยปุ่มฝากเงิน",
  "How are THB prices paid in SOL?": "ราคาเป็นบาทแต่จ่ายเป็น SOL ได้อย่างไร?",
  "Prices are set in THB and converted at a fixed {rate} THB per SOL when you pay.":
    "ราคาตั้งเป็นบาท และแปลงเป็น SOL ในอัตราคงที่ {rate} บาทต่อ SOL ตอนชำระเงิน",
  "What do I pay on top of the price?": "ต้องจ่ายอะไรเพิ่มจากราคาสินค้าบ้าง?",
  "A {pct}% buyer protection fee, which pays for escrow and the warehouse inspection. It's refunded together with your payment if the sale is cancelled.":
    "ค่าคุ้มครองผู้ซื้อ {pct}% สำหรับระบบเอสโครว์และการตรวจสอบที่คลังสินค้า หากการขายถูกยกเลิก ค่าธรรมเนียมนี้จะคืนพร้อมกับเงินที่คุณจ่าย",
  "Where does my money go when I buy?": "เมื่อซื้อแล้ว เงินของฉันไปอยู่ที่ไหน?",
  "Into an on-chain escrow, not straight to the seller. Our warehouse checks the card against its grading certificate. If it matches, the seller is paid. If it doesn't, the sale is cancelled and you get your money back.":
    "เงินจะถูกล็อกไว้ในเอสโครว์บนบล็อกเชน ไม่ได้ส่งตรงถึงผู้ขาย คลังสินค้าของเราจะตรวจการ์ดเทียบกับใบรับรองเกรด ถ้าตรงกัน ผู้ขายจะได้รับเงิน ถ้าไม่ตรง การขายจะถูกยกเลิกและคุณได้เงินคืน",
  "What if the seller never ships?": "ถ้าผู้ขายไม่ส่งของล่ะ?",
  "Sellers have {days} days to send the card to our warehouse with a tracking number. If they don't, the sale is cancelled and you're refunded.":
    "ผู้ขายมีเวลา {days} วันในการส่งการ์ดมาที่คลังสินค้าพร้อมเลขพัสดุ ถ้าไม่ส่ง การขายจะถูกยกเลิกและคุณได้เงินคืน",
  "Something's wrong with my card after it arrived. What can I do?": "การ์ดที่ได้รับมีปัญหา ต้องทำอย่างไร?",
  "Open the item page and choose \"Report a problem\" within {days} days of the purchase completing. Our team reviews it and can refund you.":
    "เปิดหน้าสินค้าแล้วเลือก \"แจ้งปัญหา\" ภายใน {days} วันหลังการซื้อเสร็จสมบูรณ์ ทีมงานจะตรวจสอบและสามารถคืนเงินให้คุณได้",
  "Should I ship my card or keep it in the vault?": "ควรให้ส่งการ์ดมาที่บ้าน หรือเก็บไว้ในห้องนิรภัย?",
  "Shipping sends the physical card to you. The vault keeps it safe with us, and a vaulted card can be resold, auctioned or swapped instantly with no shipping. You can redeem a vaulted card to your door any time.":
    "การจัดส่งคือส่งการ์ดจริงถึงมือคุณ ส่วนห้องนิรภัยจะเก็บการ์ดไว้กับเราอย่างปลอดภัย การ์ดในห้องนิรภัยขายต่อ ประมูล หรือแลกเปลี่ยนได้ทันทีโดยไม่ต้องจัดส่ง และขอรับการ์ดถึงบ้านได้ทุกเมื่อ",

  Selling: "การขาย",
  "What does it cost to sell?": "ขายการ์ดมีค่าใช้จ่ายเท่าไร?",
  "Listing a graded card with Instant Verify costs {fee}. When it sells, you send it to our warehouse, which costs {shipping}. If your card isn't graded yet, the full-service package (shipping to the grader, grading and listing) is {package}.":
    "ลงขายการ์ดที่เกรดแล้วด้วย Instant Verify ราคา {fee} เมื่อขายได้ คุณส่งการ์ดมาที่คลังสินค้าโดยมีค่าส่ง {shipping} ถ้าการ์ดยังไม่ได้เกรด แพ็กเกจบริการครบวงจร (ส่งไปเกรด ค่าเกรด และลงขาย) ราคา {package}",
  "When do I get paid?": "จะได้รับเงินเมื่อไร?",
  "When the card passes inspection at our warehouse, the escrow releases the buyer's payment to you. Cards already in the vault are inspected, so they sell instantly.":
    "เมื่อการ์ดผ่านการตรวจสอบที่คลังสินค้า เอสโครว์จะปล่อยเงินของผู้ซื้อให้คุณ การ์ดที่อยู่ในห้องนิรภัยผ่านการตรวจสอบแล้ว จึงขายได้ทันที",
  "Can I change my price?": "เปลี่ยนราคาได้ไหม?",
  "Yes, any time from Portfolio with Edit Price. Buyers watching the card are told when the price drops.":
    "ได้ทุกเมื่อ ที่หน้าพอร์ตโฟลิโอด้วยปุ่มแก้ไขราคา ผู้ที่ติดตามการ์ดใบนั้นจะได้รับแจ้งเมื่อราคาลดลง",
  "Can I take my listing down?": "ถอนประกาศขายได้ไหม?",
  "Yes, for a card you still hold: choose Delist on its card in Portfolio. An auction can be cancelled only while it has no bids. A card that's in the vault can be repriced with Relist but can't be taken off sale yet. A card in an active sale can't be delisted, because the buyer's money is already in escrow.":
    "ได้ สำหรับการ์ดที่ยังอยู่กับคุณ ให้เลือกถอนประกาศที่การ์ดใบนั้นในหน้าพอร์ตโฟลิโอ การประมูลยกเลิกได้เฉพาะตอนที่ยังไม่มีผู้เสนอราคา การ์ดในห้องนิรภัยเปลี่ยนราคาได้ด้วยปุ่มลงขายใหม่ แต่ยังถอนออกจากการขายไม่ได้ การ์ดที่อยู่ระหว่างการขายถอนประกาศไม่ได้ เพราะเงินของผู้ซื้ออยู่ในเอสโครว์แล้ว",
  "Why does my listing say \"% above market\"?": "ทำไมประกาศของฉันขึ้นว่า \"สูงกว่าราคาตลาด %\"?",
  "Each listing is compared with the market price for the exact card and grade, so buyers can see how far above or below market it is. It's information, not a judgment. A rare card can be worth more than its few comparable listings.":
    "ทุกประกาศจะถูกเทียบกับราคาตลาดของการ์ดและเกรดเดียวกัน เพื่อให้ผู้ซื้อเห็นว่าสูงหรือต่ำกว่าตลาดเท่าไร เป็นข้อมูล ไม่ใช่การตัดสิน การ์ดหายากอาจมีมูลค่ามากกว่าประกาศที่เทียบได้เพียงไม่กี่รายการ",

  Auctions: "การประมูล",
  "What happens to my money when I bid?": "เมื่อเสนอราคาประมูล เงินของฉันไปอยู่ที่ไหน?",
  "Your bid is locked in escrow when you place it and returned automatically if someone outbids you, so every winning bid can be paid.":
    "เงินประมูลจะถูกล็อกในเอสโครว์ตอนที่คุณเสนอราคา และคืนให้อัตโนมัติเมื่อมีคนเสนอราคาสูงกว่า ราคาที่ชนะทุกครั้งจึงจ่ายได้จริง",
  "Why did the auction end time move?": "ทำไมเวลาปิดประมูลถึงเลื่อน?",
  "A bid in the last 5 minutes adds 5 more minutes, so nobody can win by bidding at the last second.":
    "การเสนอราคาใน 5 นาทีสุดท้ายจะต่อเวลาอีก 5 นาที เพื่อไม่ให้ใครชนะด้วยการเสนอราคาในวินาทีสุดท้าย",
  "I won an auction. What now?": "ชนะการประมูลแล้ว ต้องทำอะไรต่อ?",
  "Choose whether to ship the card or keep it in the vault within 48 hours. If you don't choose, it goes to the vault for you, and you can redeem it later.":
    "เลือกภายใน 48 ชั่วโมงว่าจะให้ส่งการ์ดหรือเก็บไว้ในห้องนิรภัย ถ้าไม่เลือก การ์ดจะถูกเก็บในห้องนิรภัยให้ และขอรับภายหลังได้",

  "Vault and digital twins": "ห้องนิรภัยและดิจิทัลทวิน",
  "What is a digital twin?": "ดิจิทัลทวินคืออะไร?",
  "A 1-of-1 token on Solana that stands for one physical card. Owning the token means owning the card. When the card sells, the token moves to the buyer.":
    "โทเคนหนึ่งเดียวบน Solana ที่แทนการ์ดจริงหนึ่งใบ การถือโทเคนหมายถึงการเป็นเจ้าของการ์ด เมื่อการ์ดขายได้ โทเคนจะย้ายไปยังผู้ซื้อ",
  "What happens when I redeem a vaulted card?": "เกิดอะไรขึ้นเมื่อขอรับการ์ดจากห้องนิรภัย?",
  "The warehouse ships the physical card to you and the token is burned. It's final: the card can't be listed, auctioned or swapped on CardMart afterwards.":
    "คลังสินค้าจะส่งการ์ดจริงถึงคุณ และโทเคนจะถูกเผาทิ้ง การดำเนินการนี้ย้อนกลับไม่ได้ การ์ดจะลงขาย ประมูล หรือแลกเปลี่ยนบน CardMart ไม่ได้อีก",

  "Buying agent": "ผู้ช่วยซื้อ",
  "What does the buying agent do?": "ผู้ช่วยซื้อทำอะไร?",
  "You tell it which card you want and your maximum price, and it checks listings and buys a match for you from your agent wallet.":
    "บอกการ์ดที่ต้องการและราคาสูงสุดที่ยอมจ่าย ผู้ช่วยจะตรวจประกาศขายและซื้อการ์ดที่ตรงเงื่อนไขให้คุณจากกระเป๋าเงินของผู้ช่วย",
  "What does it cost?": "มีค่าใช้จ่ายเท่าไร?",
  "{fee} per task, which covers the AI that reviews listings. One task reviews up to {max} listings.":
    "งานละ {fee} สำหรับค่า AI ที่ตรวจประกาศขาย หนึ่งงานตรวจได้สูงสุด {max} ประกาศ",
};
