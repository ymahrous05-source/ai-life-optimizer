import type { Metadata, Viewport } from "next";
import AppProviders from "../components/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Optimizer — AI Time & Bio Dashboard",
  description: "AI-powered time management and bio-hacking productivity platform.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0F1419",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
