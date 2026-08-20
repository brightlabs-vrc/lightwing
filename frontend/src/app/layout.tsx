import { AuthProvider } from '@/hooks/useAuth'
import { ColorModeProvider } from '@/hooks/useColorMode'
import { NotificationProvider } from '@/hooks/useNotification'
import { QueryClientWrapper } from '@/hooks/QueryClientProvider'
import '@/styles.css'

export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ColorModeProvider>
          <NotificationProvider>
            <AuthProvider>
              <QueryClientWrapper>
                {children}
              </QueryClientWrapper>
            </AuthProvider>
          </NotificationProvider>
        </ColorModeProvider>
      </body>
    </html>
  )
}
