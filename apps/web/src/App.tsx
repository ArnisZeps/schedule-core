import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { ServiceListPage } from './pages/services/ServiceListPage'
import { ServiceFormPage } from './pages/services/ServiceFormPage'
import { AvailabilityPage } from './pages/services/AvailabilityPage'
import { AppointmentsPage } from './pages/appointments/AppointmentsPage'
import { StaffListPage } from './pages/staff/StaffListPage'
import { StaffCreatePage } from './pages/staff/StaffCreatePage'
import { StaffDetailPage } from './pages/staff/StaffDetailPage'
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
      { path: '/', element: <Navigate to="/services" replace /> },
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { path: '/services', element: <ServiceListPage /> },
          { path: '/services/new', element: <ServiceFormPage /> },
          { path: '/services/:serviceId', element: <ServiceFormPage /> },
          { path: '/services/:serviceId/availability', element: <AvailabilityPage /> },
          { path: '/appointments', element: <AppointmentsPage /> },
          { path: '/staff', element: <StaffListPage /> },
          { path: '/staff/new', element: <StaffCreatePage /> },
          { path: '/staff/:staffId', element: <StaffDetailPage /> },
        ],
      },
      { path: '*', element: <div>404 Not Found</div> },
    ],
  },
]

export const router = createBrowserRouter(routes)
