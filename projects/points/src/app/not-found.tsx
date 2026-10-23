import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-trace-pink"><Icon d={ICONS.plane} size={44} stroke={1.6} /></span>
      <h1 className="text-[26px] font-extrabold">This page took a different flight</h1>
      <p className="text-[15px] text-muted">The link may be old or mistyped.</p>
      <Link href="/" className="bg-trace mt-2 rounded-2xl px-6 py-3.5 font-extrabold text-white">Go to Trace Points</Link>
    </div>
  );
}
