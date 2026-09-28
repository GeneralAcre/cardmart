// Leaderboard: card table, top traders, market stats, heatmap, set releases.
export const LEADERBOARD: Record<string, string> = {
  "Every card for sale right now, with its real price moves. Tap + to add one to your watchlist.":
    "การ์ดทุกใบที่วางขายอยู่ตอนนี้ พร้อมความเคลื่อนไหวของราคาจริง แตะ + เพื่อเพิ่มในรายการที่ติดตาม",
  Table: "ตาราง",
  "Top traders": "เทรดเดอร์ยอดนิยม",
  Heatmap: "แผนที่ความร้อน",
  "New set releases": "ชุดใหม่ที่ออก",

  // Card table
  "All cards": "การ์ดทั้งหมด",
  "Top gainers": "ราคาขึ้นมากสุด",
  "Top losers": "ราคาลงมากสุด",
  "New drops": "มาใหม่",
  "Most watched": "ติดตามมากสุด",
  Today: "วันนี้",
  Yesterday: "เมื่อวาน",
  Tomorrow: "พรุ่งนี้",
  "Search cards": "ค้นหาการ์ด",
  "Sales 30d": "ขาย 30 วัน",
  Watchers: "ผู้ติดตาม",
  "No price gains in the last {period}.": "ไม่มีการ์ดที่ราคาขึ้นในช่วง {period}",
  "No price drops in the last {period}.": "ไม่มีการ์ดที่ราคาลงในช่วง {period}",
  "Nothing new listed in the last {days} days.": "ไม่มีการลงขายใหม่ใน {days} วันที่ผ่านมา",
  "No cards are on anyone's watchlist yet.": "ยังไม่มีการ์ดในรายการที่ติดตามของใคร",
  "No cards match your search.": "ไม่มีการ์ดที่ตรงกับการค้นหา",
  "Change compares each card's asking price with its price at the start of the period. “—” means the card wasn't listed yet. Sales count completed escrow sales of the same card and grade. Shows the top {count} cards for each tab.":
    "การเปลี่ยนแปลงเทียบราคาตั้งของการ์ดกับราคาตอนต้นช่วงเวลา “—” หมายถึงการ์ดยังไม่ได้ลงขายในตอนนั้น ยอดขายนับจากการขายผ่านเอสโครว์ที่สำเร็จของการ์ดและเกรดเดียวกัน แสดง {count} อันดับแรกในแต่ละแท็บ",
  "{name} added to your watchlist": "เพิ่ม {name} ในรายการที่ติดตามแล้ว",
  "Remove {name} from watchlist": "นำ {name} ออกจากรายการที่ติดตาม",
  "Add {name} to watchlist": "เพิ่ม {name} ในรายการที่ติดตาม",
  "On your watchlist": "อยู่ในรายการที่ติดตาม",
  "Add to watchlist": "เพิ่มในรายการที่ติดตาม",

  // Top traders
  "No completed sales yet — traders show up here once someone buys a card.": "ยังไม่มีการขายสำเร็จ — เทรดเดอร์จะแสดงที่นี่เมื่อมีคนซื้อการ์ด",
  "Who made money, and on which cards. Every card is one of a kind, so this shows what worked — there's no copy-trading a card someone else already owns.":
    "ใครทำกำไรได้ และจากการ์ดใบไหน การ์ดทุกใบมีใบเดียว หน้านี้จึงแสดงให้เห็นว่าอะไรได้ผล — ไม่สามารถก๊อปเทรดการ์ดที่คนอื่นเป็นเจ้าของอยู่แล้วได้",
  "{count} card bought": "ซื้อการ์ด {count} ใบ",
  "{count} cards bought": "ซื้อการ์ด {count} ใบ",
  "{wins}/{total} flips won": "ซื้อมาขายไปได้กำไร {wins}/{total} ครั้ง",
  Realized: "กำไรที่รับรู้แล้ว",
  Unrealized: "กำไรที่ยังไม่รับรู้",
  "What {name} traded": "การ์ดที่ {name} ซื้อขาย",
  "View store": "ดูร้าน",
  "Built from completed escrow sales only. Realized = sold price − bought price. Unrealized = a held card's current asking price − bought price. A first sale by the card's minter has no purchase price, so it isn't counted as a gain; swaps aren't counted either.":
    "คำนวณจากการขายผ่านเอสโครว์ที่สำเร็จเท่านั้น กำไรที่รับรู้แล้ว = ราคาขาย − ราคาซื้อ กำไรที่ยังไม่รับรู้ = ราคาตั้งปัจจุบันของการ์ดที่ถืออยู่ − ราคาซื้อ การขายครั้งแรกของผู้สร้างการ์ดไม่มีราคาซื้อ จึงไม่นับเป็นกำไร และไม่นับการแลกเปลี่ยน",
  "Bought {price} on {date}": "ซื้อ {price} เมื่อ {date}",
  "Sold {price} on {date}": "ขาย {price} เมื่อ {date}",
  "Holding, now {price}": "ถืออยู่ ตอนนี้ {price}",
  Holding: "ถืออยู่",

  // Market stats
  "Live listings": "รายการที่ลงขายอยู่",
  "Median asking price": "ราคาตั้งมัธยฐาน",
  "Sales · 30 days": "ยอดขาย · 30 วัน",
  "Median sale · 30 days": "ราคาขายมัธยฐาน · 30 วัน",
  "Volume · 30 days": "มูลค่าการซื้อขาย · 30 วัน",
  "No market activity yet.": "ยังไม่มีความเคลื่อนไหวในตลาด",
  Listed: "ลงขาย",
  "Price up": "ราคาขึ้น",
  "Price down": "ราคาลง",

  // Heatmap
  "All series": "ทุกชุด",
  "By series": "ตามชุด",
  "By card": "ตามการ์ด",
  "Market cap": "มูลค่าตลาด",
  "Avg price": "ราคาเฉลี่ย",
  "Top gainer": "ขึ้นมากสุด",
  "Top loser": "ลงมากสุด",
  "Largest mcap": "มูลค่าตลาดสูงสุด",
  "No cards for sale yet.": "ยังไม่มีการ์ดวางขาย",
  "Each tile is a card series (set). Size = total value listed (market cap) or average price; colour = value-weighted price change. Click a series to see its cards.":
    "แต่ละช่องคือการ์ดหนึ่งชุด ขนาด = มูลค่ารวมที่ลงขาย (มูลค่าตลาด) หรือราคาเฉลี่ย สี = การเปลี่ยนแปลงราคาถ่วงตามมูลค่า คลิกชุดเพื่อดูการ์ดในชุด",
  "Each tile is a card for sale. Size = asking price; colour = price change. Click a card to open it.":
    "แต่ละช่องคือการ์ดที่วางขาย ขนาด = ราคาตั้ง สี = การเปลี่ยนแปลงราคา คลิกการ์ดเพื่อเปิดดู",

  // Set releases
  "In {days} days": "อีก {days} วัน",
  "{days} days ago": "{days} วันที่แล้ว",
  "The release calendar needs TCG_API_KEY to be set.": "ปฏิทินการออกชุดใหม่ต้องตั้งค่า TCG_API_KEY ก่อน",
  "All games": "ทุกเกม",
  Upcoming: "กำลังจะออก",
  "Just released": "เพิ่งออก",
  "Couldn't load {games} right now (the data source may be at its daily limit). They'll reappear automatically.":
    "โหลด {games} ไม่ได้ในขณะนี้ (แหล่งข้อมูลอาจใช้ครบโควตารายวันแล้ว) จะกลับมาแสดงเองโดยอัตโนมัติ",
  "No announced upcoming sets for this game.": "ยังไม่มีการประกาศชุดใหม่ของเกมนี้",
  "No sets released in the last 90 days.": "ไม่มีชุดใหม่ออกใน 90 วันที่ผ่านมา",
  "{count} cards listed so far": "มีการ์ดในรายการแล้ว {count} ใบ",
  "Release dates come from TCGplayer's catalogue via TCG API, refreshed every 12 hours. Upcoming sets are announced products; their card lists fill in as cards are revealed. Click a set to see its products on TCGplayer.":
    "วันที่ออกมาจากแคตตาล็อกของ TCGplayer ผ่าน TCG API อัปเดตทุก 12 ชั่วโมง ชุดที่กำลังจะออกคือสินค้าที่ประกาศแล้ว รายการการ์ดจะเพิ่มเมื่อมีการเปิดเผย คลิกชุดเพื่อดูสินค้าบน TCGplayer",
};
