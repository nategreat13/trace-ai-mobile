"use client";

import { track } from "./analytics";
import { money, plural } from "./format";

/**
 * Draws a "my points are worth $X" card as a PNG and opens the phone's share
 * sheet (or saves the image where sharing files isn't supported). No
 * libraries: plain canvas, so it works offline and stays tiny.
 */
export async function sharePointsCard(opts: { worth: number; bookable: number; origin: string; best?: string }) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";

  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#FF655B");
  bg.addColorStop(0.55, "#FD297B");
  bg.addColorStop(1, "#7C3AED");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.12)";
  g.beginPath();
  g.arc(W - 120, H - 160, 380, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = "#FFFFFF";
  g.font = `800 52px ${font}`;
  g.fillText("TRACE POINTS", 90, 150);
  g.font = `600 56px ${font}`;
  g.globalAlpha = 0.9;
  g.fillText("My points are worth", 90, 420);
  g.globalAlpha = 1;
  g.font = `800 220px ${font}`;
  g.fillText(money(opts.worth), 80, 640);
  g.font = `600 56px ${font}`;
  g.globalAlpha = 0.9;
  g.fillText("in flights.", 90, 730);
  g.globalAlpha = 1;
  g.font = `800 64px ${font}`;
  g.fillText(`${plural(opts.bookable, "destination")} I can book from ${opts.origin}`, 90, 900);
  if (opts.best) {
    g.font = `600 52px ${font}`;
    g.globalAlpha = 0.9;
    g.fillText(`Including ${opts.best}`, 90, 980);
    g.globalAlpha = 1;
  }
  g.font = `700 46px ${font}`;
  g.fillText("What are your points worth? Find out free.", 90, H - 110);

  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], "my-trace-points.png", { type: "image/png" });
  const text = `My points are worth ${money(opts.worth)} in flights. What are yours worth?`;
  track("share_points", { worth: opts.worth });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, url: window.location.origin });
      return;
    } catch {
      // Cancelled; fall through to saving the image.
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
