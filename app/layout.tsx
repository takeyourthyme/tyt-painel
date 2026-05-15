import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "TYT Painel",
    description: "Painel administrativo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="pt-BR" className={`${inter.variable} light-mode`} suppressHydrationWarning>
            <body className="min-h-screen antialiased">{children}</body>
        </html>
    );
}
