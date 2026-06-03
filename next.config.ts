import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfkit external so it can read its bundled font (.afm) data files at runtime.
  serverExternalPackages: ["pdfkit"],
  // Allow Next dev resources (client JS/HMR/fonts) to load when reached via a tunnel.
  // (Only applies to `next dev`; production `next start` has no such restriction.)
  allowedDevOrigins: [
    "uniformed-flatness-urging.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
  experimental: {
    // Allow Server Actions (tier select + e-signature on the client sign page) to be
    // invoked when the app is reached through a tunnel/proxy host instead of localhost.
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "*.ngrok-free.dev",
        "*.ngrok-free.app",
        "*.ngrok.io",
        "*.ngrok.app",
        "*.trycloudflare.com",
        "*.loca.lt",
        // Cloud (Railway) deployment hosts. Add your custom domain here too.
        "*.up.railway.app",
        "*.railway.app",
      ],
    },
  },
};

export default nextConfig;
