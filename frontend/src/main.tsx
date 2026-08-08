import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { AuthProvider } from './hooks/useAuth'
import { ColorModeProvider } from './hooks/useColorMode'
import { AppThemeProvider } from './components/ThemeAndStatus'
import { NotificationProvider } from './hooks/useNotification'
import './styles.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ColorModeProvider>
        <AppThemeProvider>
          <NotificationProvider>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </NotificationProvider>
        </AppThemeProvider>
      </ColorModeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
