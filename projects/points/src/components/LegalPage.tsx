import Link from "next/link";
import { Logo } from "./ui";

/** Plain reading layout for Privacy and Terms. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col px-5 pt-4 pb-16">
      <Link href="/" aria-label="Trace Points home" className="self-start py-2">
        <Logo className="h-5" />
      </Link>
      <h1 className="pt-8 text-[30px] leading-tight font-black">{title}</h1>
      <p className="pt-1 text-[13.5px] text-muted">Last updated {updated}</p>
      <div className="legal flex flex-col gap-4 pt-6 text-[15px] leading-relaxed [&_a]:font-semibold [&_a]:underline [&_h2]:pt-3 [&_h2]:text-[18px] [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
      <p className="pt-10 text-[14px] text-muted">
        Questions? <Link href="/contact?from=legal" className="font-bold text-ink underline">Contact us</Link>.
      </p>
    </div>
  );
}
