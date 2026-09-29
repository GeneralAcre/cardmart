// Staff back office (/admin): sidebar, overview, shipments, disputes,
// support inbox, users. Older warehouse strings live in admin.ts.
export const BACKOFFICE: Record<string, string> = {
  "Back Office": "ระบบหลังบ้าน",
  "Staff only": "เฉพาะเจ้าหน้าที่",
  "Open marketplace": "เปิดหน้าตลาด",
  Menu: "เมนู",
  Overview: "ภาพรวม",
  Warehouse: "คลังสินค้า",
  Inbound: "สินค้าเข้า",
  Shipments: "การจัดส่ง",
  Vault: "ห้องนิรภัย",
  "Trust & safety": "ความปลอดภัย",
  Disputes: "ข้อพิพาท",
  Users: "ผู้ใช้",
  Support: "ฝ่ายช่วยเหลือ",
  "Support inbox": "กล่องข้อความช่วยเหลือ",
  System: "ระบบ",
  History: "ประวัติ",

  // Overview
  "{count} items need a staff decision right now.": "มี {count} รายการที่รอเจ้าหน้าที่ตัดสินใจ",
  "All queues are clear.": "ไม่มีงานค้างในทุกคิว",
  "Awaiting inspection": "รอตรวจสอบ",
  "Sold cards to check": "การ์ดที่ขายแล้วรอตรวจ",
  "Awaiting dispatch": "รอจัดส่ง",
  "Need a tracking number": "ต้องใส่เลขพัสดุ",
  "Open disputes": "ข้อพิพาทที่เปิดอยู่",
  "Buyers reporting a problem": "ผู้ซื้อที่แจ้งปัญหา",
  "Identity checks": "ตรวจสอบตัวตน",
  "ID + selfie to review": "บัตรและเซลฟีรอตรวจ",
  "Support messages": "ข้อความช่วยเหลือ",
  "Not yet handled": "ยังไม่ได้ดำเนินการ",
  "Grading in progress": "กำลังส่งเกรด",
  "Full-Service submissions": "งาน Full-Service",
  "Unread alerts": "การแจ้งเตือนที่ยังไม่อ่าน",
  "Staff notifications": "การแจ้งเตือนเจ้าหน้าที่",
  "Cards in the vault": "การ์ดในห้องนิรภัย",
  "Stored in the warehouse": "เก็บอยู่ในคลัง",
  "Latest alerts": "การแจ้งเตือนล่าสุด",
  "See all": "ดูทั้งหมด",
  "No alerts yet.": "ยังไม่มีการแจ้งเตือน",

  // Page descriptions
  "Full-Service cards on their way to, or back from, the grading company.": "การ์ด Full-Service ที่กำลังส่งไปหรือกลับจากบริษัทเกรด",
  "Where each stored card physically sits, so it can be found when it sells or is redeemed.":
    "ตำแหน่งจริงของการ์ดแต่ละใบ เพื่อหาเจอเมื่อขายหรือถูกเบิก",
  "Check each ID photo and selfie against the details the user entered.": "ตรวจรูปบัตรและเซลฟีเทียบกับข้อมูลที่ผู้ใช้กรอก",
  "Everything the platform flagged for staff, newest first.": "ทุกเรื่องที่ระบบแจ้งเจ้าหน้าที่ ล่าสุดก่อน",
  "Suspend accounts, or give a teammate staff access to this back office.": "ระงับบัญชี หรือให้สิทธิ์เจ้าหน้าที่เข้าระบบหลังบ้านนี้",
  "The last 20 inspection decisions.": "ผลการตรวจสอบ 20 รายการล่าสุด",
  "Nothing resolved yet.": "ยังไม่มีรายการที่ดำเนินการ",

  // Users
  "Make staff": "ให้สิทธิ์เจ้าหน้าที่",
  "Remove staff": "ถอนสิทธิ์เจ้าหน้าที่",
  "Staff access granted.": "ให้สิทธิ์เจ้าหน้าที่แล้ว",
  "Staff access removed.": "ถอนสิทธิ์เจ้าหน้าที่แล้ว",

  // Shipments
  "Cards leaving the warehouse. Add the courier and tracking number once it's collected; the recipient sees it on the item page.":
    "การ์ดที่ออกจากคลัง ใส่ชื่อขนส่งและเลขพัสดุเมื่อมารับแล้ว ผู้รับจะเห็นที่หน้าสินค้า",
  "Ship to": "ส่งถึง",
  Tracking: "เลขพัสดุ",
  Sale: "การขาย",
  "Vault redemption": "เบิกจากห้องนิรภัย",
  Ship: "จัดส่ง",
  "Ship this card": "จัดส่งการ์ดใบนี้",
  "Edit tracking": "แก้ไขเลขพัสดุ",
  Courier: "บริษัทขนส่ง",
  "Tracking number": "เลขพัสดุ",
  "Mark as shipped": "ยืนยันว่าส่งแล้ว",
  "No address on file": "ไม่มีที่อยู่ในระบบ",
  "Marked as shipped. The recipient was notified.": "บันทึกว่าส่งแล้ว แจ้งผู้รับแล้ว",
  "Tracking updated.": "อัปเดตเลขพัสดุแล้ว",
  "Marked as delivered.": "บันทึกว่าส่งถึงแล้ว",
  "Recently delivered": "ส่งถึงล่าสุด",
  "Nothing to ship. Approved sales and vault redemptions show up here.": "ไม่มีงานจัดส่ง การขายที่อนุมัติและการเบิกจากห้องนิรภัยจะแสดงที่นี่",

  // Disputes
  "Buyers reporting a problem with a completed purchase. Check the item's history and tracking, then record the outcome.":
    "ผู้ซื้อที่แจ้งปัญหาหลังซื้อสำเร็จ ตรวจประวัติสินค้าและการจัดส่ง แล้วบันทึกผล",
  Paid: "ยอดชำระ",
  "On-chain escrow": "เอสโครว์บนเชน",
  "Simulated escrow": "เอสโครว์จำลอง",
  "Kept in vault": "เก็บในห้องนิรภัย",
  "Reported {date}": "แจ้งเมื่อ {date}",
  "Note to the buyer: what you found and what happens next": "ข้อความถึงผู้ซื้อ: สิ่งที่ตรวจพบและขั้นตอนต่อไป",
  "The escrow was already released, so a refund is paid to the buyer outside the app. Record it here once it's sent.":
    "เงินเอสโครว์ถูกปล่อยแล้ว การคืนเงินจึงทำนอกแอป บันทึกที่นี่เมื่อโอนแล้ว",
  "Close without refund": "ปิดเรื่องโดยไม่คืนเงิน",
  "Dispute resolved. The buyer was notified.": "ปิดข้อพิพาทแล้ว แจ้งผู้ซื้อแล้ว",
  "No open disputes. Buyers can report a problem from the item page after a purchase.":
    "ไม่มีข้อพิพาท ผู้ซื้อแจ้งปัญหาได้จากหน้าสินค้าหลังการซื้อ",
  "Recently resolved": "ปิดเรื่องล่าสุด",

  // Support inbox
  "Messages sent through the contact form in the site footer. Reply by email, then mark them handled.":
    "ข้อความจากแบบฟอร์มติดต่อท้ายเว็บ ตอบกลับทางอีเมลแล้วกดว่าดำเนินการแล้ว",
  "Reply by email": "ตอบกลับทางอีเมล",
  "Mark handled": "ดำเนินการแล้ว",
  Reopen: "เปิดใหม่",
  Handled: "ดำเนินการแล้ว",
  "Marked as handled.": "บันทึกว่าดำเนินการแล้ว",
  "Moved back to the inbox.": "ย้ายกลับเข้ากล่องข้อความแล้ว",
  "Inbox zero. Messages from the site's contact form land here.": "ไม่มีข้อความค้าง ข้อความจากแบบฟอร์มติดต่อจะแสดงที่นี่",

  // Staff sign-in (admin domain)
  "Staff only. Sign in with your CardMart account.": "สำหรับเจ้าหน้าที่เท่านั้น เข้าสู่ระบบด้วยบัญชี CardMart ของคุณ",
  "{email} doesn't have staff access.": "{email} ไม่มีสิทธิ์เจ้าหน้าที่",
  "This account": "บัญชีนี้",
};
