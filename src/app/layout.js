import './globals.css';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata = {
  title: {
    template: '%s | LHMAC',
    default: 'LHMAC — Laurel Highlands Model Airplane Club',
  },
  description: 'Laurel Highlands Model Airplane Club (AMA #557) — RC flying at Mammoth Park, PA. Weather, events, photo gallery, and membership info.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <AuthProvider>
          <Navigation />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
