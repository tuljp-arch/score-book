import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';

export const metadata = {
  title: 'The Score Book',
  description: 'Your skeet record, kept properly.',
  appleWebApp: {
    title: 'Score Book',
    statusBarStyle: 'black-translucent' as const,
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#262E1E',
};

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fraunces',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
