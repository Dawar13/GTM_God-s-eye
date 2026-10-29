import type { ReactNode } from "react";
import { cn } from "cn";
import { SubTabs, type PageTab } from "./SubTabs";

/** Main area: title, optional sub-tabs, then the view. */
export function PageCanvas({
  title,
  description,
  tabs,
  children,
}: {
  title: string;
  description?: string;
  tabs?: readonly PageTab[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className={cn("border-b border-rule px-6 pt-5", tabs ? "pb-0" : "pb-5")}>
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        {tabs && <SubTabs label={`${title} views`} tabs={tabs} />}
      </header>
      <div className="flex flex-1 flex-col p-6">{children}</div>
    </div>
  );
}
