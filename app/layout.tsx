import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Energia Solar em Rondônia e Mato Grosso | Simões Energia Solar',
  description: 'Simule sua economia com energia solar e solicite uma análise gratuita para residências, comércios e propriedades',
  verification: {
    google: 'UZpq3HE-0hM__7mgAJWtY8OPgmXHIf0laB7nb6bJBIU'
  }
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}