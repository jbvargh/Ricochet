import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "900"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Ricochet",
  description: "Two agents debate your idea until they agree",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${barlowCondensed.variable} h-full bg-neutral-950 text-neutral-100 antialiased`}
    >
      <body className={`min-h-full font-sans ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
