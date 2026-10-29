import { redirect } from "next/navigation";
import { VC_MATH_TOOLS } from "@/lib/nav";

export default function VcMathIndex() {
  redirect(`/vc-math/${VC_MATH_TOOLS[0].slug}`);
}
