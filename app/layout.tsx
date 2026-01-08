import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BackgroundProvider } from "@/contexts/BackgroundContext";
import { Language, defaultLanguage, LANGUAGE_COOKIE_NAME } from "@/lib/i18n";
import dynamic from "next/dynamic";
import ScrollPrevention from "@/components/ScrollPrevention";
import { Toaster } from "sonner";

const GlobalBackgroundManager = dynamic(() => import("@/components/GlobalBackgroundManager"), {
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
  title: "Course - Make Money Today",
  description: "Start your journey to financial freedom today",
  openGraph: {
    title: "Course - Make Money Today",
    description: "Start your journey to financial freedom today",
    type: "website",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1a1a1a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read language from cookie on server to prevent hydration mismatch
  const cookieStore = cookies();
  const languageCookie = cookieStore.get(LANGUAGE_COOKIE_NAME);
  const initialLanguage: Language =
    (languageCookie?.value === 'en' || languageCookie?.value === 'ge')
      ? languageCookie.value
      : defaultLanguage;

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

