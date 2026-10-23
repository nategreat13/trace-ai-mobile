"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/** Meta Pixel base code plus a PageView on every client-side navigation. Off without a pixel id. */
export function MetaPixel() {
  const path = usePathname();
  useEffect(() => {
    const w = window as unknown as { fbq?: (...a: unknown[]) => void };
    if (PIXEL && w.fbq) w.fbq("track", "PageView");
  }, [path]);
  if (!PIXEL) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}
    </Script>
  );
}
