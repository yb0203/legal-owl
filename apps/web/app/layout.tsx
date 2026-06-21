import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legal Owl",
  description: "AI-native legal office — Case Workflow",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
