import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ConfirmDialogHost } from "@/components/ui/ConfirmDialog";
import { ImageLightboxHost } from "@/components/ui/ImageLightbox";
import { PromptDialogHost } from "@/components/ui/PromptDialog";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deera Studio",
  description: "Deera Studio — generate foto katalog & konten marketing gamis pakai AI.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full antialiased">
      {/* next/font/google butuh fetch build-time yang tidak selalu bisa diandalkan
          di lingkungan build ini; link statis di bawah diresolve browser sendiri,
          cukup untuk tool internal single-page-app ini. */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ConfirmDialogHost />
        <ImageLightboxHost />
        <PromptDialogHost />
        <Toaster
          position="top-right"
          theme="light"
          toastOptions={{
            style: {
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-text)",
            },
          }}
        />
      </body>
    </html>
  );
}
