"use client";

import { createContext, useContext, useState } from "react";

import { Tabs } from "@/components/ui/tabs";

// Which profile tab is open, shared with the parts of the page above the
// tabs, so they can step aside for a tab they don't belong with (the
// portfolio summary isn't shown on Achievements).
const ProfileTabContext = createContext<{ tab: string; setTab: (tab: string) => void } | null>(null);

export function ProfileTabsProvider({ initialTab, children }: { initialTab: string; children: React.ReactNode }) {
  const [tab, setTab] = useState(initialTab);
  return <ProfileTabContext.Provider value={{ tab, setTab }}>{children}</ProfileTabContext.Provider>;
}

/** The profile's Tabs, switched by the shared state above. */
export function ProfileTabs(props: Omit<React.ComponentProps<typeof Tabs>, "value" | "defaultValue" | "onValueChange">) {
  const ctx = useContext(ProfileTabContext);
  if (!ctx) throw new Error("ProfileTabs must be used within a ProfileTabsProvider");
  return <Tabs {...props} value={ctx.tab} onValueChange={ctx.setTab} />;
}

/** Shows its children on every profile tab except the ones listed. */
export function HiddenOnTabs({ tabs, children }: { tabs: string[]; children: React.ReactNode }) {
  const ctx = useContext(ProfileTabContext);
  if (ctx && tabs.includes(ctx.tab)) return null;
  return <>{children}</>;
}
