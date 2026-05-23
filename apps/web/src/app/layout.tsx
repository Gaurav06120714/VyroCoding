import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Vyro Coding — Code Together. Compete. Grow.',
    template: '%s | Vyro Coding',
  },
  description:
    'The multiplayer coding platform that combines LeetCode-style problems, a VS Code-like editor, and real-time collaboration rooms.',
  keywords: ['coding', 'leetcode', 'competitive programming', 'multiplayer', 'code editor'],
  openGraph: {
    title: 'Vyro Coding',
    description: 'Code Together. Compete. Grow.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
