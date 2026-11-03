// The short guided tours shown the first time someone opens a main page:
// a spotlight walks over the page's key parts, one step at a time. Finishing
// one counts toward the "Take the page tours" task on the Rewards page.
//
// Steps point at elements by their data-tour attribute. A step whose element
// isn't on the page (an empty section, or one hidden at this screen size) is
// left out; a step with no target shows as a card in the middle of the screen.
//
// A step with `tap` has a signed-in user try the feature: there's no Next,
// they tap the spotlit element. If it's a dialog or a file picker, the tour
// waits for it to close and goes on. With `opens`, it's a link to another
// page: that page's tour runs at once, and when it's over they're brought back
// here and this tour carries on from the next step. The page can allow
// skipping it by giving the element a data-tour-skip reason (no card to
// auction yet, say); that text is translated too.
// Text is English and translated with t() (Thai in lib/i18n/th/tour.ts).

type TourKey = "marketplace" | "sell" | "index" | "auctions" | "agent" | "portfolio" | "rewards" | "leaderboard";

export interface TourStep {
  /** The data-tour value of the element to spotlight. */
  target?: string;
  title: string;
  body: string;
  /** What to tap, shown instead of Next: a signed-in user has to try it to go on. */
  tap?: string;
  /** The tour on the page the spotlit link leads to. */
  opens?: TourKey;
}

export const TOURS = {
  marketplace: [
    {
      title: "Welcome to CardMart",
      body: "A quick look at how the market works. It takes under a minute, and finishing it earns you XP.",
    },
    {
      target: "search",
      title: "Search any card",
      body: "Pick a game and type a card and grade, like Umbreon PSA 10. Swipe the banner for set drops, top cards and live auctions.",
    },
    {
      target: "just-sold",
      title: "Just sold",
      body: "Real sales as they happen, and whether each sold over or under the market price.",
    },
    {
      target: "sell",
      title: "Sell a card",
      body: "List a card in a few steps. It's checked and held safely, and you're paid once the buyer has it.",
      opens: "sell",
      tap: "Tap Sell a card to see how listing works.",
    },
    {
      target: "indexes",
      title: "Market indexes",
      body: "Each index tracks the price of a group of top cards, like a stock index, so you can see where the market is heading.",
      opens: "index",
      tap: "Tap an index to look inside it.",
    },
    {
      target: "movers",
      title: "Trending cards",
      body: "The biggest price moves and a heatmap of the whole market, so you can spot what's hot.",
    },
    {
      target: "listings",
      title: "Browse and filter",
      body: "Every card for sale. Filter by game, set, grade and price, then tap a card to compare prices and buy.",
    },
    {
      target: "nav",
      title: "There's more to explore",
      body: "Auctions, the buying agent, your portfolio and rewards each have a short tour like this one, with XP for each.",
    },
  ],
  sell: [
    {
      target: "sell-details",
      title: "1. What you're listing",
      body: "Say whether it's graded. For a graded card, enter the grader and certificate number and the details fill in for you.",
    },
    {
      target: "sell-photos",
      title: "2. Prove it's yours",
      body: "Take a few live photos with your camera. They show the card is really in your hands, and buyers trust it more.",
    },
    {
      target: "sell-price",
      title: "3. Set your price",
      body: "Choose what buyers pay. Check the market price first. You can change it any time after listing.",
    },
    {
      target: "sell-preview",
      title: "Your digital certificate",
      body: "Each listed card gets a digital certificate that moves to the buyer with the card, so its history is always on record.",
    },
    {
      target: "sell-submit",
      title: "Create the listing",
      body: "Confirm and it goes live on the market. Once it sells, send the card in to be checked and you're paid when the buyer has it.",
    },
  ],
  index: [
    {
      target: "index-quote",
      title: "The index level",
      body: "One number for the price of every card in the index, and its chart over time. Up means those cards are worth more.",
    },
    {
      target: "index-movers",
      title: "Movers and statistics",
      body: "Today's biggest gainers and losers, plus the high, low and how much the index usually swings in a day.",
    },
    {
      target: "index-members",
      title: "Cards in this index",
      body: "Every card that makes up the index, with its price and change. Tap one to see it for sale.",
    },
    {
      target: "index-other",
      title: "Other indexes",
      body: "Compare with the other indexes. You can also build your own from the cards you watch, on the Market page.",
    },
  ],
  auctions: [
    {
      title: "Auctions",
      body: "Bid on real, verified cards for a limited time. The highest bid when the clock runs out wins.",
    },
    {
      target: "create-auction",
      title: "Start an auction",
      body: "Put one of your cards up for bidding. Choose a starting price and how long it runs.",
      tap: "Tap Create Auction and have a look. You can cancel it.",
    },
    {
      target: "auction-list",
      title: "Live auctions",
      body: "Filter by game, time left and grader, then open an auction to place a bid. You'll be told if someone outbids you.",
    },
  ],
  agent: [
    {
      target: "agent-intro",
      title: "Your buying agent",
      body: "Tell it the card you want and the most you'll pay. It watches every listing and buys the right one for you.",
    },
    {
      target: "agent-wallet",
      title: "Fund its wallet",
      body: "The agent pays from its own wallet, so add funds here first. It can never spend more than you allow.",
    },
    {
      target: "agent-chat",
      title: "Give it a task",
      body: "Chat with it like a shop assistant, or fill in the form. Choose whether it buys on its own or asks you first.",
    },
    {
      target: "agent-tasks",
      title: "Track its tasks",
      body: "See what it's hunting for, what it has spent and what it found. Pause or stop a task any time.",
    },
  ],
  portfolio: [
    {
      target: "profile",
      title: "Your profile",
      body: "Your store front: photo, level and badges. Verify your identity here to sell with a trusted badge.",
    },
    {
      target: "profile-photo",
      title: "Add a profile photo",
      body: "Put a face to your store. Buyers trust sellers they can see, and it earns you XP.",
      tap: "Tap your picture to choose a photo.",
    },
    {
      target: "profile-cover",
      title: "Pick a banner",
      body: "The wide picture across the top of your profile and your store page.",
      tap: "Tap Change cover to choose one.",
    },
    {
      target: "profile-edit",
      title: "Write a short bio",
      body: "A line about you and what you collect, shown under your name.",
      tap: "Tap Edit profile to write it.",
    },
    {
      target: "portfolio-tabs",
      title: "Your cards",
      body: "Cards you own, cards you've listed, your trade history, the cards you watch and the ones you want, all in tabs.",
    },
  ],
  rewards: [
    {
      target: "level",
      title: "Your level",
      body: "Everything you do on CardMart earns XP. Level up from Rookie all the way to Legend.",
    },
    {
      target: "tasks",
      title: "Tasks",
      body: "Each task shows its XP. Tap Go to jump to where you do it, and it's counted as soon as it's done.",
    },
    {
      target: "invite",
      title: "Invite friends",
      body: "Share your link or QR code. You earn XP for every friend who signs up.",
    },
  ],
  leaderboard: [
    {
      target: "community-tabs",
      title: "Community",
      body: "Switch between the leaderboard and your rewards here.",
    },
    {
      target: "traders",
      title: "Top traders",
      body: "The traders with the biggest gains. Trade well and you could earn a leaderboard badge.",
    },
  ],
} satisfies Record<TourKey, TourStep[]>;

export type TourId = keyof typeof TOURS;

export const TOUR_IDS = Object.keys(TOURS) as TourId[];

export function isTourId(value: string): value is TourId {
  return value in TOURS;
}

/** XP steps for the tour task: 25 for each tour, and a bonus 50 for the last one. */
export const TOUR_TIERS = TOUR_IDS.map((_, i) => ({ target: i + 1, xp: i === TOUR_IDS.length - 1 ? 75 : 25 }));

/** XP earned from this many finished tours. */
export function tourXp(count: number): number {
  return TOUR_TIERS.filter((tier) => count >= tier.target).reduce((sum, tier) => sum + tier.xp, 0);
}

/** The page each tour is on, for the Rewards task's Go link (?tour replays it). */
export const TOUR_PAGES: Record<TourId, string> = {
  marketplace: "/marketplace",
  sell: "/marketplace/sell",
  index: "/market/index/cardmart",
  auctions: "/auctions",
  agent: "/agent",
  portfolio: "/portfolio",
  rewards: "/rewards",
  leaderboard: "/leaderboard",
};
