import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { ResourceListPage } from './pages/resources/ResourceListPage'
import { ResourceFormPage } from './pages/resources/ResourceFormPage'
import { AvailabilityPage } from './pages/resources/AvailabilityPage'
import { AppointmentsPage } from './pages/appointments/AppointmentsPage'
import { Outlet } from 'react-router-dom'

function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export const routes = [
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <Navigate to="/resources" replace /> },
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { path: '/resources', element: <ResourceListPage /> },
          { path: '/resources/new', element: <ResourceFormPage /> },
          { path: '/resources/:resourceId', element: <ResourceFormPage /> },
          { path: '/resources/:resourceId/availability', element: <AvailabilityPage /> },
          { path: '/appointments', element: <AppointmentsPage /> },
        ],
      },
      { path: '*', element: <div>404 Not Found</div> },
    ],
  },
]

export const router = createBrowserRouter(routes)
