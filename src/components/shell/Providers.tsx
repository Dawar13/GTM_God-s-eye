"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { MotionConfig } from "framer-motion";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUi } from "@/store/ui";
import { useInspectorStore } from "@/store/inspector";
import { Shortcuts } from "./Shortcuts";

// The palette (cmdk, its search and the name index) loads the first time it opens.
const CommandPalette = dynamic(() => import("./CommandPalette").then((m) => m.CommandPalette), {
  ssr: false,
});

function LazyPalette() {
  const open = useUi((s) => s.paletteOpen);
  const [wanted, setWanted] = useState(false);
  if (open && !wanted) setWanted(true);
  return wanted ? <CommandPalette /> : null;
}

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
          <LazyPalette />
        </TooltipProvider>
      </MotionConfig>
    </NuqsAdapter>
  );
}
