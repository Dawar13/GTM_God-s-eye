"use client";

import { Menu } from "lucide-react";
import { useUi } from "@/store/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { RailNav } from "./RailNav";

/** Below 1024px the rail is a sheet opened from a hamburger in the top bar. */
export function MobileNav() {
  const open = useUi((s) => s.mobileNavOpen);
  const setOpen = useUi((s) => s.setMobileNavOpen);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-ink-2 lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] gap-0 p-0 sm:max-w-[280px]">
          <div className="flex h-12 shrink-0 items-center gap-3 border-b border-rule px-5">
            <span aria-hidden className="size-2.5 shrink-0 rotate-45 bg-accent" />
            <SheetTitle className="text-base font-semibold">Capital Atlas</SheetTitle>
          </div>
          <SheetDescription className="sr-only">Sections and views</SheetDescription>
          <RailNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
