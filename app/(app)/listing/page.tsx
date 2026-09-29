import { redirect } from "next/navigation";

// Selling moved inside the Marketplace — keeps old links and bookmarks working.
export default function ListingRedirect() {
  redirect("/marketplace/sell");
}
