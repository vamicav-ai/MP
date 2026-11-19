import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EduReels",
    short_name: "EduReels",
    description: "Full-length classes and focused educational reels.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#2c8059",
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
