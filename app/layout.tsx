import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mesh Studio 3D',
  description: 'Interactive 3D product visualizer — Next.js 14, React Three Fiber, Drei',
};

export const viewport: Viewport = { themeColor: '#0f1115' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
