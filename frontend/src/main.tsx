import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PxlKitSurfaceProvider, PxlKitToastProvider } from '@pxlkit/ui-kit'
import { router } from './router'
import { AuthProvider } from './hooks/useAuth'
import './styles.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PxlKitSurfaceProvider surface="pixel">
        <PxlKitToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </PxlKitToastProvider>
      </PxlKitSurfaceProvider>
    </QueryClientProvider>
  </StrictMode>,
)
