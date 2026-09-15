import type { Metadata } from "next";
import "./globals.css";
import "./responsive.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "ThesisGuard — Preserve research. Protect integrity.",
    template: "%s | ThesisGuard",
  },
  description:
    "An academic thesis repository with transparent similarity analysis and responsible citation guidance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
