import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fraubot — LEUTE!",
  description: "German translation, reply modes, and class chat.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
