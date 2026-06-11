import './globals.css'

export const metadata = {
  title: 'MGEN CRM V5',
  description: 'MGEN Renewables CRM with live leads and lead detail profiles',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
