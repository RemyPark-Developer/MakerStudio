import type { Metadata } from "next";
import "./globals.css";
import { NavAuthButtons } from "./NavAuthButtons";

export const metadata: Metadata = {
  title: "MakerStudio",
  description: "AI와 함께 배우는 메이커 교육 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderBottom: "1px solid var(--grid-line)",
          }}
        >
          <NavAuthButtons />
        </header>
        {children}
      </body>
    </html>
  );
}