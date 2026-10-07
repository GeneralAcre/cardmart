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
      titleLine1: "Know the market",
      titleLine2: "Trade cards with confidence",
      subtitle:
        "CardMart is the data platform and secure global marketplace for trading cards. Market intelligence and safe peer-to-peer trading in one place, so collectors can trade smarter",
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
      titleLine1: "รู้ทันตลาด",
      titleLine2: "ซื้อขายการ์ดอย่างมั่นใจ",
      subtitle:
        "CardMart คือแพลตฟอร์มข้อมูลและตลาดซื้อขายการ์ดสะสมระดับโลกที่ปลอดภัย รวมข้อมูลเชิงลึกของตลาดและการซื้อขายระหว่างผู้ใช้อย่างปลอดภัยไว้ในที่เดียว ช่วยให้นักสะสมซื้อขายได้อย่างชาญฉลาดยิ่งขึ้น",
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
