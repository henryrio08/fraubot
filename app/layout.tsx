import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEUTE! — German, in the moment.",
  description: "Catch the German. Get the meaning. Find your next words.",
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
