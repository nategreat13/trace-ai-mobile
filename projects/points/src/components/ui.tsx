"use client";

import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { PROGRAMS } from "@/engine/data";
import type { ProgramId } from "@/engine/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** The Trace wordmark. Follows the theme unless `light` forces the white version (for photos). */
export function Logo({ className = "h-6", light }: { className?: string; light?: boolean }) {
  if (light) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/trace-logo-light.png" alt="Trace" className={cx("w-auto", className)} />;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/trace-logo.png" alt="Trace" className={cx("w-auto dark:hidden", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/trace-logo-light.png" alt="" aria-hidden="true" className={cx("hidden w-auto dark:block", className)} />
    </>
  );
}

/** Staggered entrance: index → animation delay. */
export const stagger = (i: number, step = 45): CSSProperties => ({ animationDelay: `${Math.min(i, 14) * step}ms` });

/** Trace's red-to-pink CTA, with a soft shimmer so it draws the eye. */
export function PrimaryButton({ className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cx(
        "w-full min-h-[58px] rounded-2xl px-5 py-4 text-[17px] font-extrabold text-white transition active:scale-[0.98]",
        disabled ? "bg-soft text-muted" : "bg-trace shimmer shadow-[0_10px_28px_rgba(253,41,123,0.32)]",
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
        "w-full min-h-[50px] rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] font-bold text-ink active:bg-soft",
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
        "min-h-[40px] whitespace-nowrap rounded-full border px-4 text-[14px] font-bold transition active:scale-95",
        on ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Program logo. Uses the development logo under /public/logos and falls back
 * to the 2–3 letter badge, so licensed marks can drop in without layout changes.
 */
export function ProgramBadge({ id, size = 44 }: { id: ProgramId; size?: number }) {
  const p = PROGRAMS[id];
  const [broken, setBroken] = useState(false);
  const radius = Math.round(size * 0.26);
  if (broken) {
    return (
      <span
        aria-hidden="true"
        className="nums inline-flex shrink-0 items-center justify-center font-bold text-white"
        style={{ width: size, height: size, borderRadius: radius, background: p.badgeColor, fontSize: Math.round(size * 0.3) }}
      >
        {p.badge}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={p.logo}
      alt=""
      aria-hidden="true"
      onError={() => setBroken(true)}
      className="shrink-0 bg-white object-cover shadow-[0_0_0_1px_rgba(15,23,48,0.08)]"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={cx("rounded-3xl border border-line bg-surface", className)} style={style}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-[11.5px] font-extrabold tracking-[0.08em] text-muted uppercase", className)}>{children}</div>;
}

export function Check({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
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
  plane: "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
  compass: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 13h2M3 7l12-4v4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  bonus: "M4 12h12M12 6l6 6-6 6",
  seat: "M7 4v9a3 3 0 0 0 3 3h7M7 13h9a2 2 0 0 1 2 2v5M5 20h14",
  bed: "M3 18v-7a2 2 0 0 1 2-2h4v6h12v3M3 15h18M7 9a2 2 0 1 0 0-.01",
  shield: "M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z",
  clock: "M12 7v5l3 3M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z",
  star: "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  person: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a7 7 0 0 1 16 0v1",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  pin: "M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
} as const;

/** Green "can book" / amber "short" status text. */
export function Status({ ok, children, className }: { ok: boolean; children: ReactNode; className?: string }) {
  return <span className={cx("font-bold", ok ? "text-ok" : "text-near", className)}>{children}</span>;
}

export function StatusPill({ ok, children, className }: { ok: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-extrabold whitespace-nowrap", ok ? "bg-ok-bg text-ok" : "bg-near-bg text-near", className)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", ok ? "bg-trace-green" : "bg-[#F59E0B]")} />
      {children}
    </span>
  );
}

/** Economy reads light and airy; business is midnight with gold, so the two never look alike. */
export function CabinBadge({ business, label }: { business: boolean; label?: string }) {
  return business ? (
    <span className="bg-premium inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-gold uppercase">
      <Icon d={ICONS.bed} size={13} stroke={2.2} />
      {label ?? "Business"}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky/10 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-sky uppercase">
      <Icon d={ICONS.seat} size={13} stroke={2.2} />
      {label ?? "Economy"}
    </span>
  );
}

/** A one-shot burst of confetti in Trace colors. Pure CSS, respects reduced motion. */
export function Confetti({ count = 60 }: { count?: number }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(false), 3200);
    return () => window.clearTimeout(t);
  }, []);
  const pieces = useMemo(() => {
    const colors = ["#FF655B", "#FD297B", "#00D665", "#0EA5E9", "#F5B83D", "#7C3AED"];
    return Array.from({ length: count }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      color: colors[i % colors.length],
      delay: `${(i % 12) * 60}ms`,
      dur: `${1800 + ((i * 53) % 1200)}ms`,
      dx: `${((i * 29) % 120) - 60}px`,
      rot: `${((i * 97) % 720) - 360}deg`,
      w: 6 + (i % 3) * 2,
    }));
  }, [count]);
  if (!on) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] mx-auto max-w-[480px] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-[2px]"
          style={
            {
              left: p.left,
              width: p.w,
              height: p.w * 1.6,
              background: p.color,
              animation: `confetti-fall ${p.dur} cubic-bezier(0.2, 0.6, 0.4, 1) ${p.delay} both`,
              "--dx": p.dx,
              "--rot": p.rot,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
