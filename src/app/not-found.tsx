import Link from "next/link";
import { PageCanvas } from "@/components/shell/PageCanvas";

export default function NotFound() {
  return (
    <PageCanvas title="Page not found">
      <p className="text-sm text-ink-2">
        This address doesn&apos;t match a view.{" "}
        <Link href="/" className="text-ink underline underline-offset-4">
          Go to Command
        </Link>
        .
      </p>
    </PageCanvas>
  );
}
