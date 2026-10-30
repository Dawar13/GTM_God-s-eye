import type { Metadata } from "next";
import { PageCanvas } from "@/components/shell/PageCanvas";
import { getInvestors } from "@/lib/data";
import { Showcase } from "./Showcase";

export const metadata: Metadata = { title: "Lab" };

/**
 * Internal style guide: every Atlas primitive in a light and a dark panel. Values marked
 * "Example" are placeholders; the investor count is read from the loaders.
 */
export default async function LabPage() {
  const investors = await getInvestors();
  return (
    <PageCanvas
      title="Lab"
      description="Design system primitives in both themes. Internal; not a product view."
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {(["light", "dark"] as const).map((theme) => (
          <div
            key={theme}
            data-theme={theme}
            className="rounded-xl border border-rule p-5"
            aria-label={`${theme} theme`}
            role="group"
          >
            <h2 className="mb-5 text-xl font-semibold">
              {theme === "light" ? "Light theme" : "Dark theme"}
            </h2>
            <Showcase investorCount={investors.length} />
          </div>
        ))}
      </div>
    </PageCanvas>
  );
}
