export type Locale = "en" | "th";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "th", label: "ไทย" },
];

export const DEFAULT_LOCALE: Locale = "en";

export const LANDING_DICTIONARY = {
  en: {
    nav: {
      goToMarketplace: "Login",
    },
    login: {
      continue: "Continue with Google or Email",
      redirecting: "Redirecting…",
    },
    hero: {
      badge: "Beta · Running on a Test Blockchain",
      titleLine1: "What's your card",
      titleLine2: "really worth?",
      subtitle: "See real prices for every grade. Then buy and sell safely, right here.",
      noWalletNote: "No wallet needed to start — one is created for you automatically",
    },
    cta: {
      enterMarketplace: "Go to marketplace",
    },
    pillars: {
      badge: "What CardMart does",
      title: "Everything you need to trade cards, in one place.",
      items: [
        {
          title: "See the market",
          description: "Live prices, trends, and news for graded cards, so you know what a card is worth before you trade.",
        },
        {
          title: "Trade safely",
          description: "Buy and sell peer to peer. Payment is held until the card passes inspection at our warehouse.",
        },
        {
          title: "Own it for real",
          description: "Every card comes with a digital certificate on the blockchain, backed by the physical card in our vault.",
        },
      ],
    },
    showcase: {
      badge: "Inside CardMart",
      title: "See it before you sign in.",
      subtitle: "Price data, protected payments, live auctions and an agent that shops for you — here's what each looks like.",
      sample: "Sample data",
      market: {
        eyebrow: "Market data",
        title: "Know what a card is worth, grade by grade.",
        description:
          "Price history from completed CardMart sales, checked against eBay and TCGplayer. Switch grades to see what a PSA 10 is worth next to a raw copy before you set a price or make an offer.",
        points: ["Sale history in every grade", "eBay and TCGplayer prices side by side", "Rankings and price moves across the market"],
        chartLabel: "Market price",
        inRange: "in range",
        gradeTitle: "Same card, by grade",
      },
      escrow: {
        eyebrow: "Protected payments",
        title: "Your money waits until the card checks out.",
        description:
          "The buyer pays into escrow on the blockchain. Our warehouse inspects the card, and only then is the seller paid. If it isn't what was listed, the buyer gets the money back.",
        points: ["Payment held in an on-chain escrow", "Every card inspected at our warehouse", "Ship it home or keep it in the vault"],
        orderTitle: "Order #4821",
        held: "Held in escrow",
        steps: ["Paid into escrow", "Seller shipped", "Inspected at warehouse", "Payment released to seller"],
        stepDetails: ["Oct 3, 14:02", "Tracking EX 7712 0934 TH", "In progress", "After inspection"],
      },
      auction: {
        eyebrow: "Live auctions",
        title: "Bid in real time, settle on-chain.",
        description:
          "Run an auction with a start time and reserve, or bid on someone else's. Every bid shows up live, and the winner pays through the same escrow as any other sale.",
        points: ["Live bids and countdown", "Start time and reserve price", "Winner pays through escrow"],
        live: "Live",
        currentBid: "Current bid",
        endsIn: "Ends in",
        bids: "Bids",
        placeBid: "Place bid",
      },
      agent: {
        eyebrow: "Buying agent",
        title: "Tell the agent what you want. It watches the market for you.",
        description:
          "Name a card, a grade and your max price. The agent checks every new listing day and night, compares it with recent sales, and asks you first or buys for you.",
        points: ["Never pays over your max price", "Skips look-alikes from other sets", "Pays through escrow like any purchase"],
        you: "Find me an Umbreon VMAX alt art, PSA 10, under THB 26,000.",
        working: "Checked 214 new listings",
        found: "Found one at THB 24,900 — 6% under the 30-day median sale.",
        approve: "Buy it",
        skip: "Skip",
      },
    },
    features: {
      badge: "Why CardMart",
      title: "Built so nobody has to just take your word for it.",
      items: [
        {
          title: "Protected payments on every sale",
          description: "The buyer's payment is held safely until the item passes inspection at our warehouse.",
        },
        {
          title: "Instant vault trading",
          description: "Items already in the vault transfer ownership instantly, with zero shipping fees.",
        },
        {
          title: "Live camera verification",
          description: "Sellers prove physical possession with a live capture — no gallery uploads accepted.",
        },
        {
          title: "Real PSA cert lookups",
          description: "Certificate numbers are checked live against PSA's own public verification database.",
        },
        {
          title: "A real wallet, automatically",
          description: "Sign in with Google or email and a secure crypto wallet is created for you — no confusing setup.",
        },
        {
          title: "Warehouse-inspected custody",
          description: "Physical items are verified at our warehouse before ownership ever changes hands.",
        },
      ],
    },
    steps: {
      badge: "How it works",
      title: "From sign-in to sold, in four steps.",
      items: [
        {
          title: "Sign in",
          description: "Google, email, or an existing wallet — a real Solana wallet is ready the moment you're in.",
        },
        {
          title: "List or send for grading",
          description: "Already certified? Document it live on camera and list it. Raw item? We ship it out for grading for you.",
        },
        {
          title: "List it for sale",
          description: "Set a price. Your digital certificate goes live on the marketplace, backed by the real item.",
        },
        {
          title: "Sell with payment protection",
          description: "The buyer's payment is held safely, the item is inspected, then it ships to them or joins the vault.",
        },
      ],
    },
    closing: {
      titleAuthenticated: "Welcome back.",
      titleGuest: "Ready to try it?",
      subtitleAuthenticated: "Pick up where you left off — browse, list, or check on your portfolio.",
      subtitleGuest:
        "Sign in and you're a verified collector with a real wallet in seconds — browse, list, or buy your first certified item today.",
      freeSignInNote: "Free to sign in — you only pay when you list or buy.",
    },
  },
  th: {
    nav: {
      goToMarketplace: "ไปที่ตลาดซื้อขาย",
    },
    login: {
      continue: "เข้าสู่ระบบด้วย Google หรืออีเมล",
      redirecting: "กำลังนำทาง…",
    },
    hero: {
      badge: "เบต้า · ทำงานบนบล็อกเชนทดสอบ",
      titleLine1: "การ์ดของคุณ",
      titleLine2: "มีมูลค่าเท่าไรกันแน่?",
      subtitle: "ดูราคาจริงในทุกเกรด แล้วซื้อขายได้อย่างปลอดภัยที่นี่",
      noWalletNote: "ไม่ต้องมีกระเป๋าเงินก่อนเริ่มใช้งาน ระบบจะสร้างให้อัตโนมัติ",
    },
    cta: {
      enterMarketplace: "ไปที่ตลาดซื้อขาย",
    },
    pillars: {
      badge: "CardMart ทำอะไร",
      title: "ทุกอย่างที่ต้องใช้ในการซื้อขายการ์ด รวมไว้ในที่เดียว",
      items: [
        {
          title: "รู้ราคาตลาด",
          description: "ราคา เทรนด์ และข่าวสารของการ์ดเกรดแบบเรียลไทม์ รู้มูลค่าการ์ดก่อนซื้อขาย",
        },
        {
          title: "ซื้อขายอย่างปลอดภัย",
          description: "ซื้อขายระหว่างผู้ใช้โดยตรง เงินจะถูกพักไว้จนกว่าการ์ดจะผ่านการตรวจสอบที่คลังสินค้าของเรา",
        },
        {
          title: "เป็นเจ้าของจริง",
          description: "การ์ดทุกใบมีใบรับรองดิจิทัลบนบล็อกเชน พร้อมการ์ดจริงเก็บรักษาในวอลต์ของเรา",
        },
      ],
    },
    showcase: {
      badge: "ภายใน CardMart",
      title: "ดูก่อนเข้าสู่ระบบ",
      subtitle: "ข้อมูลราคา การชำระเงินที่ได้รับการคุ้มครอง การประมูลสด และเอเจนต์ที่ช่วยซื้อการ์ดให้คุณ — หน้าตาเป็นแบบนี้",
      sample: "ข้อมูลตัวอย่าง",
      market: {
        eyebrow: "ข้อมูลตลาด",
        title: "รู้มูลค่าการ์ดในทุกเกรด",
        description:
          "ประวัติราคาจากการขายที่สำเร็จบน CardMart เทียบกับ eBay และ TCGplayer สลับเกรดเพื่อดูว่า PSA 10 มีมูลค่าเท่าไรเทียบกับการ์ดดิบ ก่อนตั้งราคาหรือยื่นข้อเสนอ",
        points: ["ประวัติการขายในทุกเกรด", "ราคา eBay และ TCGplayer เทียบกันได้ทันที", "อันดับและการเคลื่อนไหวของราคาทั้งตลาด"],
        chartLabel: "ราคาตลาด",
        inRange: "ในช่วงเวลานี้",
        gradeTitle: "การ์ดใบเดียวกัน แยกตามเกรด",
      },
      escrow: {
        eyebrow: "การชำระเงินที่ได้รับการคุ้มครอง",
        title: "เงินของคุณจะรอจนกว่าการ์ดผ่านการตรวจสอบ",
        description:
          "ผู้ซื้อชำระเงินเข้าเอสโครว์บนบล็อกเชน คลังสินค้าของเราตรวจสอบการ์ดก่อน แล้วผู้ขายจึงได้รับเงิน หากไม่ตรงตามที่ลงขาย ผู้ซื้อได้รับเงินคืน",
        points: ["เงินถูกพักไว้ในเอสโครว์บนบล็อกเชน", "การ์ดทุกใบตรวจสอบที่คลังสินค้าของเรา", "ส่งถึงบ้านหรือเก็บไว้ในวอลต์"],
        orderTitle: "คำสั่งซื้อ #4821",
        held: "พักไว้ในเอสโครว์",
        steps: ["ชำระเงินเข้าเอสโครว์", "ผู้ขายจัดส่งแล้ว", "ตรวจสอบที่คลังสินค้า", "โอนเงินให้ผู้ขาย"],
        stepDetails: ["3 ต.ค. 14:02", "เลขพัสดุ EX 7712 0934 TH", "กำลังดำเนินการ", "หลังการตรวจสอบ"],
      },
      auction: {
        eyebrow: "ประมูลสด",
        title: "ประมูลแบบเรียลไทม์ ชำระเงินบนบล็อกเชน",
        description:
          "เปิดประมูลพร้อมกำหนดเวลาเริ่มและราคาขั้นต่ำ หรือร่วมประมูลการ์ดของคนอื่น ทุกการเสนอราคาแสดงผลทันที และผู้ชนะชำระผ่านเอสโครว์เหมือนการซื้อทั่วไป",
        points: ["เสนอราคาและนับถอยหลังแบบสด", "กำหนดเวลาเริ่มและราคาขั้นต่ำ", "ผู้ชนะชำระเงินผ่านเอสโครว์"],
        live: "สด",
        currentBid: "ราคาปัจจุบัน",
        endsIn: "สิ้นสุดใน",
        bids: "การเสนอราคา",
        placeBid: "เสนอราคา",
      },
      agent: {
        eyebrow: "เอเจนต์ช่วยซื้อ",
        title: "บอกเอเจนต์ว่าต้องการอะไร แล้วมันจะเฝ้าตลาดให้คุณ",
        description:
          "ระบุการ์ด เกรด และราคาสูงสุด เอเจนต์จะตรวจทุกรายการใหม่ทั้งวันทั้งคืน เทียบกับราคาขายล่าสุด แล้วถามคุณก่อนหรือซื้อให้เลย",
        points: ["ไม่จ่ายเกินราคาสูงสุดที่ตั้งไว้", "ข้ามการ์ดหน้าตาคล้ายจากชุดอื่น", "ชำระผ่านเอสโครว์เหมือนการซื้อทั่วไป"],
        you: "หา Umbreon VMAX alt art เกรด PSA 10 ราคาไม่เกิน THB 26,000 ให้หน่อย",
        working: "ตรวจรายการใหม่แล้ว 214 รายการ",
        found: "เจอแล้วที่ THB 24,900 — ต่ำกว่าราคาขายกลาง 30 วันอยู่ 6%",
        approve: "ซื้อเลย",
        skip: "ข้าม",
      },
    },
    features: {
      badge: "ทำไมต้อง CardMart",
      title: "ออกแบบมาให้ไม่ต้องเชื่อคำพูดใครเปล่าๆ",
      items: [
        {
          title: "การชำระเงินปลอดภัยทุกการขาย",
          description: "เงินของผู้ซื้อจะถูกพักไว้อย่างปลอดภัยจนกว่าสินค้าจะผ่านการตรวจสอบที่คลังสินค้าของเรา",
        },
        {
          title: "ซื้อขายจากในวอลต์ได้ทันที",
          description: "สินค้าที่อยู่ในวอลต์อยู่แล้วโอนกรรมสิทธิ์ได้ทันที ไม่มีค่าจัดส่ง",
        },
        {
          title: "ยืนยันตัวตนด้วยกล้องสด",
          description: "ผู้ขายต้องพิสูจน์ว่าครอบครองสินค้าจริงด้วยการถ่ายสด ไม่รับรูปจากคลังภาพ",
        },
        {
          title: "ตรวจสอบเลขใบรับรอง PSA จริง",
          description: "หมายเลขใบรับรองถูกตรวจสอบแบบเรียลไทม์กับฐานข้อมูลตรวจสอบสาธารณะของ PSA โดยตรง",
        },
        {
          title: "มีกระเป๋าเงินจริงให้อัตโนมัติ",
          description: "เข้าสู่ระบบด้วย Google หรืออีเมล แล้วรับกระเป๋าคริปโตที่ปลอดภัยโดยไม่ต้องตั้งค่าอะไรให้ยุ่งยาก",
        },
        {
          title: "ดูแลรักษาโดยคลังสินค้าที่ผ่านการตรวจสอบ",
          description: "สินค้าจริงจะถูกตรวจสอบที่คลังสินค้าของเราก่อนโอนกรรมสิทธิ์ทุกครั้ง",
        },
      ],
    },
    steps: {
      badge: "วิธีการทำงาน",
      title: "จากเข้าสู่ระบบถึงขายสำเร็จ ใน 4 ขั้นตอน",
      items: [
        {
          title: "เข้าสู่ระบบ",
          description: "ด้วย Google อีเมล หรือกระเป๋าเงินที่มีอยู่แล้ว — กระเป๋า Solana จริงพร้อมใช้งานทันที",
        },
        {
          title: "ยืนยันหรือส่งตรวจสภาพ",
          description: "มีใบรับรองอยู่แล้ว? ยืนยันสดผ่านกล้องได้เลย ยังไม่ได้เกรด? เราจัดส่งไปตรวจสภาพให้",
        },
        {
          title: "ลงขายสินค้า",
          description: "ตั้งราคา แล้วใบรับรองดิจิทัลของคุณจะขึ้นบนตลาดซื้อขาย พร้อมสินค้าจริงรองรับ",
        },
        {
          title: "ขายพร้อมความคุ้มครองการชำระเงิน",
          description: "เงินของผู้ซื้อจะถูกพักไว้อย่างปลอดภัย จากนั้นสินค้าจะถูกตรวจสอบก่อนจัดส่งหรือเก็บเข้าวอลต์",
        },
      ],
    },
    closing: {
      titleAuthenticated: "ยินดีต้อนรับกลับมา",
      titleGuest: "พร้อมลองใช้งานแล้วหรือยัง?",
      subtitleAuthenticated: "กลับมาทำต่อจากที่ค้างไว้ — เลือกชม ลงขาย หรือดูพอร์ตของคุณ",
      subtitleGuest:
        "เข้าสู่ระบบแล้วกลายเป็นนักสะสมที่ยืนยันตัวตนแล้วพร้อมกระเป๋าเงินจริงในไม่กี่วินาที — เลือกชม ลงขาย หรือซื้อสินค้าที่มีใบรับรองชิ้นแรกของคุณวันนี้",
      freeSignInNote: "เข้าสู่ระบบฟรี จ่ายเฉพาะตอนลงขายหรือซื้อสินค้าเท่านั้น",
    },
  },
} as const;

export type LandingDictionary = (typeof LANDING_DICTIONARY)[Locale];
