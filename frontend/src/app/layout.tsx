import type { Metadata } from "next";
import "./globals.css";
import { LayoutShell } from "@/components/layout/LayoutShell";

export const metadata: Metadata = {
  title: "SysMonitor - System Monitoring Dashboard",
  description: "Dark monitoring dashboard for system metrics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-sm-bg text-sm-text font-sans antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
