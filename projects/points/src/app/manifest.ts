import type { MetadataRoute } from "next";

/** Home-screen install: Trace's app icon and name. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trace Points",
    short_name: "Trace",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
