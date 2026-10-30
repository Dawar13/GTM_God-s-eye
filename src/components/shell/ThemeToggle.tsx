"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "cn";
import { useUi } from "@/store/ui";

/**
 * Icon and label switch on the data-theme attribute through CSS, so the
 * server render matches whatever the init script applied before paint.
 */
export function ThemeToggle({ labelClass, className }: { labelClass: string; className?: string }) {
  const setTheme = useUi((s) => s.setTheme);
  const syncThemeFromDocument = useUi((s) => s.syncThemeFromDocument);

  useEffect(() => {
    syncThemeFromDocument();
  }, [syncThemeFromDocument]);

  return (
    <button
      type="button"
      onClick={() =>
        setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
      }
      className={className}
    >
      <Sun aria-hidden className="size-4 shrink-0 light:hidden" />
      <Moon aria-hidden className="hidden size-4 shrink-0 light:block" />
      <span className={cn(labelClass)}>
        <span className="light:hidden">Use light theme</span>
        <span className="hidden light:inline">Use dark theme</span>
      </span>
    </button>
  );
}
