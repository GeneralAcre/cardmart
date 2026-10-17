"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/landing/language-provider";
import { useTheme } from "@/components/site/theme-provider";

/** The sun/moon theme button that sits in every page header. */
export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const { tr: t } = useLanguage();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={next === "light" ? t("Switch to light mode") : t("Switch to dark mode")}
      title={next === "light" ? t("Switch to light mode") : t("Switch to dark mode")}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
