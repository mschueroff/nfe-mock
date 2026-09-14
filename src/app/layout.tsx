import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'NF-e Mock | Documentos de teste',
  description: 'Gerador local de XML NF-e e DANFE sem valor fiscal para testes de integração.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
