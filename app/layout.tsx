import type { Metadata } from 'next'
import './globals.css'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: 'Empresa de Energia Solar em Rondônia e Mato Grosso | Simões',
  description:
    'Projetos e instalação de placas solares em RO e MT. Economize até 95% na conta de luz de sua residência, empresa ou propriedade rural. Orçamento grátis!',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: BASE,
    siteName: 'Simões Energia Solar',
    locale: 'pt_BR',
    title: 'Energia Solar em Rondônia e Mato Grosso | Economize até 95%',
    description:
      'Projetos e instalação de placas solares em RO e MT. Economize até 95% na conta de luz de sua residência, empresa ou propriedade rural. Orçamento grátis!',
    images: [
      {
        url: '/projects/residencial.jpg',
        width: 1600,
        height: 1200,
        alt: 'Projeto de instalação de placas solares da Simões Energia Solar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Energia Solar em Rondônia e Mato Grosso | Economize até 95%',
    description:
      'Projetos e instalação de placas solares em RO e MT. Economize até 95% na conta de luz de sua residência, empresa ou propriedade rural. Orçamento grátis!',
    images: ['/projects/residencial.jpg'],
  },
  verification: {
    google: 'UZpq3HE-0hM__7mgAJWtY8OPgmXHIf0laB7nb6bJBIU',
  },
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
