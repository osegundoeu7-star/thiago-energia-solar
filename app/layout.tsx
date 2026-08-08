import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Thiago Energia Solar', description: 'Energia inteligente para o seu imóvel.' }
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html> }
