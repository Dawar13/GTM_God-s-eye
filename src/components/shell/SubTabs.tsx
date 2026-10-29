"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export type PageTab = { href: string; label: string };

/** Sub-tab navigation. Links, not tab widgets: the URL is the state. */
export function SubTabs({ label, tabs }: { label: string; tabs: readonly PageTab[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="mt-4 -mb-px flex gap-5 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.href === pathname;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 pb-2.5 text-sm whitespace-nowrap transition-colors",
              active ? "border-amber text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
