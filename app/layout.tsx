export const metadata = {
  title: 'The Score Book',
  description: 'Your skeet record, kept properly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
