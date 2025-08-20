import type { Metadata } from "next";
import { Providers } from "./providers";
import { Space_Grotesk } from "next/font/google";
import ThemeBackground from "./components/layout/ThemeBackground";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Beat Sage",
  description: "Rhythm-based cultivation game",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body>
        <Providers>
          <ThemeBackground />
          {children}
        </Providers>
      </body>
    </html>
  );
}
