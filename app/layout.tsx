import './globals.css'

export const metadata = {
  title: 'MGEN CRM V7',
  description: 'MGEN Renewables CRM with live leads, file centre, proposals and commercial calculator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
