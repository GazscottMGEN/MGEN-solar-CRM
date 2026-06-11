import './globals.css'

export const metadata = {
  title: 'MGEN CRM V6',
  description: 'MGEN Renewables CRM with live leads and file upload centre',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
