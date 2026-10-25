import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pyrius — AI travel concierge",
    short_name: "Pyrius",
    description: SITE_DESCRIPTION,
    start_url: "/app",
    display: "standalone",
    background_color: "#090A0D",
    theme_color: "#090A0D",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
