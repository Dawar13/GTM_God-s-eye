"use client";

import { useEffect } from "react";
import { useUi } from "@/store/ui";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Global shortcuts: Ctrl/Cmd+K palette, / search, [ rail, F filters.
 * Escape is handled by whatever is open (palette, popover, inspector).
 * Plain keys are ignored while typing; Ctrl/Cmd+K still works there, since it
 * is not a typing key and people expect it in a text field.
 */
export function Shortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isEditable(e.target) || ui.paletteOpen) return;
      if (document.querySelector('[role="dialog"]')) return;

      if (e.key === "/") {
        e.preventDefault();
        ui.setPaletteOpen(true);
      } else if (e.key === "[") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) ui.toggleRail();
        else ui.setMobileNavOpen(!ui.mobileNavOpen);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        ui.toggleFilters();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
