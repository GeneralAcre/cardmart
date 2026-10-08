// Site chrome (header, nav, footer, notifications, wallet) and the shared
// status/label values from lib/labels.ts. Grading-company tier names
// ("Gem Mint 10", "Pristine 10") are left in English on purpose — that's
// how Thai collectors say them too.
export const COMMON: Record<string, string> = {
  // Nav
  Marketplace: "ตลาด",
  Market: "ตลาด",
  Leaderboard: "อันดับ",
  Ranking: "อันดับ",
  Auctions: "ประมูล",
  Listing: "ลงขาย",
  Portfolio: "พอร์ต",
  Admin: "แอดมิน",
  Home: "หน้าแรก",
  "Getting Started": "เริ่มต้นใช้งาน",
  "Warehouse Admin": "แอดมินคลังสินค้า",
  "Terms of Use": "ข้อกำหนดการใช้งาน",
  "Privacy Policy": "นโยบายความเป็นส่วนตัว",

  // Header / account
  Collector: "นักสะสม",
  Messages: "ข้อความ",
  "Getting started guide": "คู่มือเริ่มต้นใช้งาน",
  "Sign out": "ออกจากระบบ",
  "Signed out": "ออกจากระบบแล้ว",

  // Notifications
  Notifications: "การแจ้งเตือน",
  "{count} new": "ใหม่ {count}",
  "Updates about your collection, offers, and auctions.": "อัปเดตเกี่ยวกับคอลเลกชัน ข้อเสนอ และการประมูลของคุณ",
  "Recent activity": "กิจกรรมล่าสุด",
  "Mark all read": "อ่านทั้งหมดแล้ว",
  "Nothing yet. Auction, offer, and collection updates will appear here.":
    "ยังไม่มีอะไร การอัปเดตการประมูล ข้อเสนอ และคอลเลกชันจะแสดงที่นี่",

  // Wallet
  "Address copied — safe to send test SOL here": "คัดลอกที่อยู่แล้ว — ส่ง SOL ทดสอบมาที่นี่ได้อย่างปลอดภัย",
  "Wallet connected": "เชื่อมต่อกระเป๋าเงินแล้ว",
  "Connecting…": "กำลังเชื่อมต่อ…",
  "Connect Wallet": "เชื่อมต่อกระเป๋าเงิน",
  "Solana Wallet (Test Network)": "กระเป๋าเงิน Solana (เครือข่ายทดสอบ)",
  "Send test SOL to this address to fund it:": "ส่ง SOL ทดสอบมาที่อยู่นี้เพื่อเติมเงิน:",

  // Footer / contact
  "Contact & Support": "ติดต่อและช่วยเหลือ",
  "Contact us": "ติดต่อเรา",
  "Send us a message and we'll reply by email.": "ส่งข้อความถึงเรา แล้วเราจะตอบกลับทางอีเมล",
  "Real prices for every grade, and a safe place to buy and sell your cards.":
    "ราคาจริงในทุกเกรด และพื้นที่ปลอดภัยสำหรับซื้อขายการ์ดของคุณ",
  Navigation: "เมนู",
  "Legal & Compliance": "กฎหมายและการปฏิบัติตามข้อกำหนด",
  Social: "โซเชียล",
  "Message sent — we'll get back to you soon.": "ส่งข้อความแล้ว — เราจะติดต่อกลับโดยเร็ว",
  Name: "ชื่อ",
  Email: "อีเมล",
  Message: "ข้อความ",
  "Sending…": "กำลังส่ง…",
  Send: "ส่ง",

  // Games / categories
  "Pokémon": "โปเกมอน",
  "One Piece": "วันพีซ",
  "Trading Card": "การ์ดสะสม",
  "Sports Card": "การ์ดกีฬา",
  "Graded Comic": "คอมิกที่ผ่านการเกรด",
  Ungraded: "ยังไม่เกรด",

  // Market status
  "Ready to Ship": "พร้อมส่ง",
  "In Vault": "อยู่ในห้องนิรภัย",
  "Sale Pending": "รอปิดการขาย",
  "Not Listed": "ไม่ได้ลงขาย",
  "Up for Auction": "กำลังประมูล",

  // Auction / offer / trade status
  Active: "กำลังดำเนินอยู่",
  "Ended — Sold": "จบแล้ว — ขายได้",
  "Ended — No Bids": "จบแล้ว — ไม่มีผู้ประมูล",
  "Ended — Unclaimed": "จบแล้ว — ผู้ชนะไม่มารับ",
  Cancelled: "ยกเลิกแล้ว",
  Pending: "รอดำเนินการ",
  Accepted: "ยอมรับแล้ว",
  Rejected: "ปฏิเสธแล้ว",
  Declined: "ปฏิเสธแล้ว",
  Withdrawn: "ถอนแล้ว",
  Swapped: "แลกแล้ว",

  // Pipeline / inbound / escrow
  "Awaiting Seller Shipment": "รอผู้ขายจัดส่ง",
  "In Transit to Warehouse": "กำลังส่งไปคลังสินค้า",
  "In Inspection": "กำลังตรวจสอบ",
  "In Transit to Buyer": "กำลังส่งถึงผู้ซื้อ",
  Delivered: "ส่งถึงแล้ว",
  "Deposited to Vault": "ฝากเข้าห้องนิรภัยแล้ว",
  "Pending Inspection": "รอตรวจสอบ",
  "Approved — Ship to Buyer": "อนุมัติ — ส่งให้ผู้ซื้อ",
  "Approved — Deposited to Vault": "อนุมัติ — ฝากเข้าห้องนิรภัย",
  "Payment Held": "พักเงินไว้",
  "Payment Held Safely": "พักเงินไว้อย่างปลอดภัย",
  "Paid to Seller": "จ่ายเงินให้ผู้ขายแล้ว",
  "Refunded to Buyer": "คืนเงินให้ผู้ซื้อแล้ว",
  "Payment Refunded": "คืนเงินแล้ว",

  // Verification packages / grading submissions
  "Seller-verified": "ผู้ขายยืนยันเอง",
  "Back": "กลับ",
  "Full-Service Grading": "บริการส่งเกรดครบวงจร",
  "Awaiting Shipment to Grading Co.": "รอส่งไปบริษัทเกรด",
  "At Grading Company": "อยู่ที่บริษัทเกรด",
  "Graded & Minted": "เกรดและสร้างใบรับรองแล้ว",

  // Provenance
  "Digital Certificate Created": "สร้างใบรับรองดิจิทัลแล้ว",
  "Listed for Sale": "ลงขายแล้ว",
  Delisted: "ถอนการขายแล้ว",
  "Shipped to Warehouse": "ส่งไปคลังสินค้าแล้ว",
  "Inspection Passed": "ผ่านการตรวจสอบ",
  "Inspection Rejected": "ไม่ผ่านการตรวจสอบ",
  "Delivered to Buyer": "ส่งถึงผู้ซื้อแล้ว",
  "Ownership Transferred": "โอนกรรมสิทธิ์แล้ว",
  "Relisted for Instant Sale": "ลงขายใหม่แบบขายทันที",
  "Physical Item Redeemed": "ถอนของจริงออกแล้ว",
  "Digital Twin Burned": "เผาใบรับรองดิจิทัลแล้ว",
  "Swapped in a Card Trade": "แลกเปลี่ยนการ์ดแล้ว",
  "Transfer Approved": "อนุมัติการโอนแล้ว",

  // KYC
  "Not verified": "ยังไม่ยืนยันตัวตน",
  "Under review": "กำลังตรวจสอบ",
  "ID verified": "ยืนยันตัวตนแล้ว",
  "Verification declined": "การยืนยันตัวตนถูกปฏิเสธ",
  "National ID card": "บัตรประชาชน",
  Passport: "หนังสือเดินทาง",
  "Driving licence": "ใบขับขี่",
};
