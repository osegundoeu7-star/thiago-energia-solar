import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Energia Solar em Rondônia e Mato Grosso | Thiago Energia Solar', description: 'Simule sua economia com energia solar e solicite uma análise gratuita para residências, comércios e propriedades em Rondônia e Mato Grosso.' }
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html> }
