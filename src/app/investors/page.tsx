import { redirect } from "next/navigation";
import { INVESTOR_VIEWS } from "@/lib/nav";

export default function InvestorsIndex() {
  redirect(`/investors/${INVESTOR_VIEWS[0].slug}`);
}
