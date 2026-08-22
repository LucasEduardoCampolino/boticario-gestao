// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastProvider } from './components/ToastContainer'
import InstallPWA from './components/InstallPWA'
import Dashboard from './pages/Dashboard'
import SaleDetails from './pages/SaleDetails'
import Customers from './pages/Customers'
import CustomerDetails from './pages/CustomerDetails'
import Products from './pages/Products'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Backup from './pages/Backup'
import Login from './pages/Login'

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          
          <Route path="vendas" element={<Navigate to="/financeiro" replace />} />
          <Route path="vendas/:id" element={<SaleDetails />} />
          
          <Route path="clientes" element={<Customers />} />
          <Route path="clientes/:id" element={<CustomerDetails />} />
          
          <Route path="produtos" element={<Products />} />
          <Route path="financeiro" element={<Finance />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="configuracoes" element={<Settings />} />
          <Route path="backup" element={<Backup />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <InstallPWA />
    </ToastProvider>
  )
}

export default App