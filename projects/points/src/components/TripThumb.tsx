"use client";

import { useState } from "react";
import { fallbackFor, photoFor } from "@/lib/images";
import { cx } from "./ui";

/**
 * Destination photo, or a Trace-colored tile with the airport code. The caller
 * sizes and positions it (e.g. "absolute inset-0" or "h-14 w-14").
 */
export function TripThumb({
  city,
  code,
  className,
  blur,
  showCode = true,
}: {
  city: string;
  code: string;
  className?: string;
  blur?: boolean;
  showCode?: boolean;
}) {
  const src = photoFor(city);
  const [broken, setBroken] = useState(false);
  return (
    <div
      className={cx("flex items-center justify-center overflow-hidden", className)}
      style={{ background: fallbackFor(city) }}
      aria-hidden="true"
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className={cx("h-full w-full object-cover", blur && "blur-md scale-110")}
        />
      ) : (
        showCode && (
          <span className={cx("font-mono text-[13px] font-bold text-white", blur && "blur-sm")}>
            {code}
          </span>
        )
      )}
    </div>
  );
}
