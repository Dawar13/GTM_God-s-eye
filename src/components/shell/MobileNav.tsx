"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
import { APP_NAME } from "@/lib/nav";
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
          <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-rule px-4">
            <Image
              src="/brand/logo.png"
              alt=""
              width={288}
              height={192}
              className="h-6 w-auto shrink-0"
            />
            <SheetTitle className="text-base font-semibold">{APP_NAME}</SheetTitle>
          </div>
          <SheetDescription className="sr-only">Sections and views</SheetDescription>
          <RailNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
