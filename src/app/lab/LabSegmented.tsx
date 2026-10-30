"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui-atlas";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "fresh", label: "Fresh funds" },
  { value: "older", label: "Older" },
] as const;

/** Client wrapper so the server /lab page can show a working Segmented. */
export function LabSegmented() {
  const [value, setValue] = useState<(typeof OPTIONS)[number]["value"]>("all");
  return <Segmented label="Example view" options={OPTIONS} value={value} onChange={setValue} />;
}
