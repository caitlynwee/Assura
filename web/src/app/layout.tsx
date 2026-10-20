import type { Metadata } from "next";
// Self-hosted Geist (bundled from node_modules) — no runtime call to Google
// Fonts, so builds and demos work on restricted or flaky venue networks.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assura — AI Insurance Assistant",
  description:
    "Compare critical illness insurance plans and let AI contact insurers on your behalf — with your approval at every step.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
