import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MALIKEEP | Business Management",
  description:
    "A smart business management platform for small businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
