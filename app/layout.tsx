import './globals.css'

export const metadata = {
  title: 'MGEN CRM V9',
  description: 'MGEN Renewables CRM with PDF sales proposal engine',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
