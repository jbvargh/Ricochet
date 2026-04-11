import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
      className={`dark ${inter.variable} h-full bg-neutral-950 text-neutral-100 antialiased`}
    >
      <body className={`min-h-full font-sans ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
