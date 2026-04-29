import type { Metadata } from "next";
import { Inter, Gantari, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/Toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const gantari = Gantari({
  variable: "--font-gantari",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FinAgent — Deep Research for Markets",
  description:
    "An agentic financial analyst. Orchestrates retrieval, fundamentals, and analysis across markets and filings.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${gantari.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
