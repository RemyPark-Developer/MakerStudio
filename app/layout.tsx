import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MakerStudio",
  description: "AI와 함께 배우는 메이커 교육 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
