import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CATCAPTION Admin",
  description: "Protected admin panel for CATCAPTION",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
