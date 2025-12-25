import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BackgroundProvider } from "@/contexts/BackgroundContext";
import dynamic from "next/dynamic";

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
  return (
      <html lang="ge" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 
                    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <BackgroundProvider>
            <I18nProvider>
              <GlobalBackgroundManager />
              {children}
            </I18nProvider>
          </BackgroundProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

