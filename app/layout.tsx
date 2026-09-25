import type { Metadata } from 'next'
import './globals.css'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thiago-energia-solar.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: 'Energia Solar em Rondônia e Mato Grosso | Simões Energia Solar',
  description:
    'Simule sua economia com energia solar e solicite uma análise gratuita para residências, comércios e propriedades',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: BASE,
    siteName: 'Simões Energia Solar',
    locale: 'pt_BR',
    title: 'Energia Solar em Rondônia e Mato Grosso | Simões Energia Solar',
    description:
      'Simule sua economia com energia solar e solicite uma análise gratuita para residências, comércios e propriedades',
    images: [
      {
        url: '/projects/residencial.jpg',
        width: 1600,
        height: 1200,
        alt: 'Projeto de energia solar residencial da Simões Energia Solar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Energia Solar em Rondônia e Mato Grosso | Simões Energia Solar',
    description:
      'Simule sua economia com energia solar e solicite uma análise gratuita para residências, comércios e propriedades',
    images: ['/projects/residencial.jpg'],
  },
  verification: {
    google: 'UZpq3HE-0hM__7mgAJWtY8OPgmXHIf0laB7nb6bJBIU',
  },
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
