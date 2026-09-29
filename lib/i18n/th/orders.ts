// Order flow after a sale: the seller's "ship it to CardMart" task, the
// buyer's order progress, and the back-office view of sales awaiting shipment.
export const ORDERS: Record<string, string> = {
  // Seller: ship to warehouse
  "Ship your sold cards ({count})": "ส่งการ์ดที่ขายแล้ว ({count})",
  "Sales on their way to inspection": "รายการขายที่กำลังส่งไปตรวจสอบ",
  "Sold for {amount}": "ขายได้ {amount}",
  "{days} days left": "เหลือ {days} วัน",
  "Less than 1h left": "เหลือไม่ถึง 1 ชม.",
  "Pack the card securely: sleeve or slab case, then bubble wrap in a rigid box.":
    "แพ็กการ์ดให้แน่นหนา: ใส่ซองหรือเคสสแลบ ห่อบับเบิลแล้วใส่กล่องแข็ง",
  "Write this reference on the package:": "เขียนรหัสนี้บนพัสดุ:",
  "Send it to:": "ส่งไปที่:",
  "Copy address": "คัดลอกที่อยู่",
  "Add the tracking number:": "ใส่เลขพัสดุ:",
  "I've shipped it": "ส่งแล้ว",
  "Ship by {date}. If it isn't shipped by then, the sale is cancelled and the buyer refunded.":
    "ส่งภายใน {date} หากไม่ส่งภายในเวลานี้ การขายจะถูกยกเลิกและคืนเงินให้ผู้ซื้อ",
  "Shipped — awaiting inspection": "ส่งแล้ว — รอตรวจสอบ",
  "You're paid {amount} once it passes inspection.": "คุณจะได้รับ {amount} เมื่อผ่านการตรวจสอบ",
  "Fix tracking number": "แก้ไขเลขพัสดุ",
  "Marked as shipped. The buyer was notified.": "บันทึกว่าส่งแล้ว แจ้งผู้ซื้อแล้ว",
  "Enter the courier.": "กรอกชื่อบริษัทขนส่ง",
  "Enter the tracking number.": "กรอกเลขพัสดุ",
  "This isn't one of your sales.": "รายการนี้ไม่ใช่การขายของคุณ",
  "This sale is no longer waiting for you to ship.": "รายการขายนี้ไม่ได้รอให้คุณจัดส่งแล้ว",
  "The shipping deadline has passed, so this sale is being cancelled.": "เลยกำหนดส่งแล้ว การขายนี้กำลังถูกยกเลิก",

  // Buyer: order progress
  "Your order": "คำสั่งซื้อของคุณ",
  "Paid into escrow": "ชำระเงินเข้าเอสโครว์แล้ว",
  "Waiting for the seller to ship": "รอผู้ขายจัดส่ง",
  "Seller shipped": "ผู้ขายส่งแล้ว",
  "By {date}, or you're refunded automatically": "ภายใน {date} มิฉะนั้นคืนเงินให้อัตโนมัติ",
  "Checked at our warehouse": "ตรวจสอบที่คลังของเรา",
  "We match the card to its certificate before paying the seller": "เราตรวจการ์ดกับใบรับรองก่อนจ่ายเงินให้ผู้ขาย",
  "Stored in your vault": "เก็บในห้องนิรภัยของคุณ",
  "Shipped to you": "จัดส่งถึงคุณ",

  // Back office
  Package: "พัสดุ",
  "Waiting for sellers to ship": "รอผู้ขายจัดส่ง",
  "Sold, but not sent in yet. These join the queue above once the seller adds tracking; past the deadline the buyer is refunded automatically.":
    "ขายแล้วแต่ยังไม่ส่งเข้ามา จะเข้าคิวด้านบนเมื่อผู้ขายใส่เลขพัสดุ หากเลยกำหนดจะคืนเงินผู้ซื้ออัตโนมัติ",
  "Ship by": "ส่งภายใน",
  "Waiting for Seller to Ship": "รอผู้ขายจัดส่ง",
  "Cancelled — Seller Didn't Ship": "ยกเลิก — ผู้ขายไม่ได้จัดส่ง",
};
