import type { Metadata } from 'next';

import './globals.css';
import React from 'react';

export const metadata: Metadata = {
  title: 'Keyvan | Honesty-Driven',
  description:
    'Built with dedication and the invaluable support of my friend ChatGPT :)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
