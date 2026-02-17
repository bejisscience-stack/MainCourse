import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BackgroundProvider } from "@/contexts/BackgroundContext";
import { Language, defaultLanguage } from "@/lib/i18n";
import dynamic from "next/dynamic";
import ScrollPrevention from "@/components/ScrollPrevention";
import { Toaster } from "sonner";

const GlobalBackgroundManager = dynamic(() => import("@/components/GlobalBackgroundManager"), {
  ssr: false,
  loading: () => null,
});

const ReferralCapture = dynamic(() => import("@/components/ReferralCapture"), {
  ssr: false,
  loading: () => null,
});

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Swavleba",
  description: "Start your journey to financial freedom today",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-256x256.png', sizes: '256x256', type: 'image/png' },
      { url: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/apple-touch-icon-76x76.png', sizes: '76x76', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  other: {
    'msapplication-TileColor': '#22c55e',
    'msapplication-config': '/browserconfig.xml',
  },
  openGraph: {
    title: "Swavleba",
    description: "Start your journey to financial freedom today",
    type: "website",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#22c55e',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use static default - cookies() can block/hang during dev. I18nProvider syncs from client on hydration.
  const initialLanguage: Language = defaultLanguage;

  return (
      <html lang={initialLanguage} className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Always set dark mode
                  document.documentElement.classList.add('dark');
                  localStorage.setItem('theme', 'dark');
                } catch (e) {}

              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        <ThemeProvider>
          <BackgroundProvider>
            <I18nProvider initialLanguage={initialLanguage}>
              <ScrollPrevention />
              <GlobalBackgroundManager />
              <Suspense fallback={null}>
                <ReferralCapture />
              </Suspense>
              <div className="min-h-full w-full overflow-x-hidden">
                {children}
              </div>
              <Toaster
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  className: 'dark:bg-navy-800 dark:border-navy-700',
                }}
              />
            </I18nProvider>
          </BackgroundProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

