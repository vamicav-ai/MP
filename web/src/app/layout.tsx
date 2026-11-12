import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduReels — Learn in your flow",
  description: "Full-length classes and focused educational reels in one learning space.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
