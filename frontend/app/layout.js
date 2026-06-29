import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import Footer from '@/components/Footer';
import ClientLayout from '@/components/ClientLayout';
import { LanguageProvider } from '@/lib/i18n';

export const metadata = {
  title: 'Agrinet — Agricultural Marketplace',
  description: 'Buy and sell agricultural commodities safely, with guaranteed escrow and protected payments.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <ToastProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
            <Footer />
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
