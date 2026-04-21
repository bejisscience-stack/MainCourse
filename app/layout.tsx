import type { Metadata } from "next";
import { Inter, Noto_Sans_Georgian, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BackgroundProvider } from "@/contexts/BackgroundContext";
import { Language, defaultLanguage } from "@/lib/i18n";
import Script from "next/script";
import dynamic from "next/dynamic";
import ScrollPrevention from "@/components/ScrollPrevention";
import { Toaster } from "sonner";
import { PostHogProvider } from "@/contexts/PostHogContext";

const PostHogPageView = dynamic(() => import("@/components/PostHogPageView"), {
  ssr: false,
  loading: () => null,
});

const GlobalBackgroundManager = dynamic(
  () => import("@/components/GlobalBackgroundManager"),
  {
    ssr: false,
    loading: () => null,
  },
);

const ReferralCapture = dynamic(() => import("@/components/ReferralCapture"), {
  ssr: false,
  loading: () => null,
});

const ProfileCompletionGuard = dynamic(
  () => import("@/components/ProfileCompletionGuard"),
  {
    ssr: false,
    loading: () => null,
  },
);

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
});

const notoGeorgian = Noto_Sans_Georgian({
  subsets: ["georgian"],
  display: "swap",
  preload: true,
  variable: "--font-noto-georgian",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-jb-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Swavleba",
  description: "Start your journey to financial freedom today",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-64x64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-256x256.png", sizes: "256x256", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      {
        url: "/apple-touch-icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
      },
      {
        url: "/apple-touch-icon-120x120.png",
        sizes: "120x120",
        type: "image/png",
      },
      { url: "/apple-touch-icon-76x76.png", sizes: "76x76", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  other: {
    "msapplication-TileColor": "#22c55e",
    "msapplication-config": "/browserconfig.xml",
  },
  openGraph: {
    title: "Swavleba",
    description: "Start your journey to financial freedom today",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#22c55e",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use static default - cookies() can block/hang during dev. I18nProvider syncs from client on hydration.
  const initialLanguage: Language = defaultLanguage;

  // CSP-01: Read per-request nonce from middleware for inline script allowlisting
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  return (
    <html
      lang={initialLanguage}
      className={`${inter.variable} ${notoGeorgian.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <meta
          name="facebook-domain-verification"
          content="q23z4y9bvjtat94qbfj9zc9e631r97"
        />
        {/* SECURITY: This script is hardcoded. NEVER insert user input here. */}
        <script
          nonce={nonce}
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
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1633851123922990&ev=PageView&nonce=1"
            alt=""
          />
        </noscript>
      </head>
      <body className={`${inter.className} overflow-x-hidden`}>
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '1633851123922990');
              fbq('track', 'PageView');
            `,
          }}
        />
        <PostHogProvider>
          <ThemeProvider>
            <BackgroundProvider>
              <I18nProvider initialLanguage={initialLanguage}>
                <Suspense fallback={null}>
                  <PostHogPageView />
                </Suspense>
                <ScrollPrevention />
                <ProfileCompletionGuard />
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
                    className: "dark:bg-navy-800 dark:border-navy-700",
                  }}
                />
              </I18nProvider>
            </BackgroundProvider>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
