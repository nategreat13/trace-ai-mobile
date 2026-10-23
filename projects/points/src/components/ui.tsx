"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { PROGRAMS } from "@/engine/data";
import type { ProgramId } from "@/engine/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Logo({ className = "h-6" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/trace-logo.png" alt="Trace" className={cx("w-auto", className)} />;
}

/** Trace's red-to-pink gradient CTA, as on the mobile paywall. */
export function PrimaryButton({ className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cx(
        "w-full min-h-[56px] rounded-[14px] px-5 py-4 text-[17px] font-extrabold text-white transition active:scale-[0.99]",
        disabled
          ? "bg-[#E5E5E5] text-[#9A9A9A]"
          : "bg-gradient-to-r from-trace-red to-trace-pink shadow-[0_8px_24px_rgba(253,41,123,0.25)]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(
        "w-full min-h-[48px] rounded-[14px] border border-line bg-white px-4 py-3 text-[15px] font-bold text-ink active:bg-soft",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({
  on,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cx(
        "min-h-[38px] whitespace-nowrap rounded-full border px-3.5 text-[14px] font-bold transition",
        on ? "border-trace-red bg-trace-red text-white" : "border-line bg-white text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Stand-in for program logos until licensed marks drop in. Same footprint either way. */
export function ProgramBadge({ id, size = 44 }: { id: ProgramId; size?: number }) {
  const p = PROGRAMS[id];
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-xl font-mono font-bold text-white"
      style={{ width: size, height: size, background: p.badgeColor, fontSize: Math.round(size * 0.3) }}
    >
      {p.badge}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-white", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-[12px] font-extrabold tracking-[0.06em] text-muted uppercase", className)}>{children}</div>;
}

export function Check({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" aria-hidden="true" className={className}>
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

export function LockIcon({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function HeartIcon({ filled, size = 22 }: { filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
    </svg>
  );
}

export function Icon({ d, size = 20, stroke = 2, className }: { d: string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  back: "M15 6l-6 6 6 6",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  menu: "M4 7h16M4 12h16M4 17h16",
  filter: "M4 6h16M7 12h10M10 18h4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  plane: "M2 16l20-7-6 13-3-6-6-1z",
  compass: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 13h2M3 7l12-4v4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  bonus: "M4 12h12M12 6l6 6-6 6",
  seat: "M5 17V7a2 2 0 0 1 2-2h4v12M5 17h14M13 12h6v5",
  shield: "M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z",
  clock: "M12 7v5l3 3M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  star: "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  person: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a7 7 0 0 1 16 0v1",
} as const;

/** Green "can book" / amber "short" status text. */
export function Status({ ok, children, className }: { ok: boolean; children: ReactNode; className?: string }) {
  return <span className={cx("font-bold", ok ? "text-ok" : "text-near", className)}>{children}</span>;
}

export function StatusPill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold", ok ? "bg-ok-bg text-ok" : "bg-near-bg text-near")}>
      {children}
    </span>
  );
}
