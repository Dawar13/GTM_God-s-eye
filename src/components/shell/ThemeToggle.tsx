"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useUi } from "@/store/ui";
import { Button } from "@/components/ui/button";

/**
 * Icon swaps on the data-theme attribute through CSS, so the server render
 * matches whatever the init script applied before paint.
 */
export function ThemeToggle() {
  const toggleTheme = useUi((s) => s.toggleTheme);
  const syncThemeFromDocument = useUi((s) => s.syncThemeFromDocument);

  useEffect(() => {
    syncThemeFromDocument();
  }, [syncThemeFromDocument]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Switch colour theme"
      title="Switch colour theme"
      className="text-ink-2"
    >
      <Sun aria-hidden className="light:hidden" />
      <Moon aria-hidden className="hidden light:block" />
    </Button>
  );
}
