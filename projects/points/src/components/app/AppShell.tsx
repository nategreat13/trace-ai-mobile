"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { num } from "@/lib/format";
import { useDeck, usePoints } from "@/lib/store";
import { useAlerts } from "./alerts";
import { cx, Icon, ICONS, Logo } from "../ui";

const NAV = [
  { href: "/discover", label: "Discover", icon: ICONS.compass },
  { href: "/trips", label: "My trips", icon: ICONS.heart },
  { href: "/plan", label: "Plan a trip", icon: ICONS.search },
  { href: "/alerts", label: "Alerts", icon: ICONS.bell },
  { href: "/points", label: "My points", icon: ICONS.wallet },
  { href: "/account", label: "Account and settings", icon: ICONS.gear },
  { href: "/contact?from=menu", label: "Contact us", icon: ICONS.mail },
];

/** Members-only chrome: logo, points pill, hamburger drawer. No bottom tab bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, ready } = usePoints();
  const { values } = useDeck();
  const { unread } = useAlerts();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ready && !state.member) router.replace("/");
  }, [ready, state.member, router]);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Keep the page behind the drawer from scrolling on phones.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!ready || !state.member) return <div className="min-h-dvh" />;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-2.5 bg-surface/85 pr-3 pl-5 shadow-[0_1px_0_rgba(15,23,48,0.06)] backdrop-blur-xl">
        <Link href="/discover" aria-label="Trace home">
          <Logo className="h-5" />
        </Link>
        <span className="bg-trace ml-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide text-white">POINTS</span>
        <div className="flex-1" />
        <Link href="/points" className="nums rounded-full bg-midnight px-3 py-1.5 text-[13px] font-extrabold text-white dark:bg-soft dark:text-ink">
          {num(values.total)} pts
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="relative flex h-11 w-11 items-center justify-center rounded-xl"
        >
          <Icon d={ICONS.menu} size={24} stroke={2.2} />
          {unread > 0 && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-trace-red" />}
        </button>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      {open && (
        <div className="fixed inset-0 z-50 mx-auto max-w-[480px]">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fade absolute inset-0 bg-midnight/50" />
          <nav aria-label="Main" className="slide-in-right absolute inset-y-0 right-0 flex w-[300px] max-w-[86%] flex-col gap-1 rounded-l-[28px] bg-surface px-3 pt-4 pb-safe shadow-2xl">
            <div className="flex items-center justify-between pb-2 pl-3">
              <span className="text-[20px] font-black">Menu</span>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted">
                <Icon d={ICONS.close} size={20} />
              </button>
            </div>
            {NAV.map((n) => {
              const on = path === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  // The path effect only fires when the route changes; tapping the current page must close too.
                  onClick={() => setOpen(false)}
                  className={cx("flex min-h-[52px] items-center gap-3.5 rounded-xl px-3 text-[16px] font-bold", on ? "bg-trace text-white shadow-[0_8px_20px_rgba(253,41,123,0.25)]" : "text-ink active:bg-soft")}
                >
                  <Icon d={n.icon} size={22} />
                  <span className="flex-1">{n.label}</span>
                  {n.href === "/alerts" && unread > 0 && (
                    <span className={cx("nums rounded-full px-2 py-0.5 text-[11px] font-extrabold", on ? "bg-surface text-trace-pink" : "bg-trace-pink text-white")}>{unread}</span>
                  )}
                </Link>
              );
            })}
            <div className="flex-1" />
            <div className="border-t border-line px-3 pt-3 text-[13px] text-muted">
              {state.email || "Member"} · from {state.airport}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
