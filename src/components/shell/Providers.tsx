"use client";

import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUi } from "@/store/ui";
import { useInspectorStore } from "@/store/inspector";
import { CommandPalette } from "./CommandPalette";
import { Shortcuts } from "./Shortcuts";

export function Providers({ children }: { children: ReactNode }) {
  // Persisted rail and filter-row state is read after hydration, not during it.
  useEffect(() => {
    void useUi.persist.rehydrate();
    void useInspectorStore.persist.rehydrate();
  }, []);

  return (
    <NuqsAdapter>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          {children}
          <Shortcuts />
          <CommandPalette />
        </TooltipProvider>
      </MotionConfig>
    </NuqsAdapter>
  );
}
