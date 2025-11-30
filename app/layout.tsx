import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: {
        template: '%s | Дашборд',
        default: 'Дашборд'
    },
    description: 'Дашборд по официальному курсу Next.js от Vercel, использует App Router.',
    metadataBase: new URL('https://next-learn-dashboard.vercel.sh')
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${inter.className} antialiased`}>{children}</body>
        </html>
    );
}
