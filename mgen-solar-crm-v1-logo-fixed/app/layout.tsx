import './globals.css'

export const metadata = {
  title: 'MGEN Solar CRM',
  description: 'MGEN Renewables internal solar sales platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
