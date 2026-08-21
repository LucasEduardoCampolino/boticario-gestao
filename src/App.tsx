// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastProvider } from './components/ToastContainer'
import Dashboard from './pages/Dashboard'
import SaleDetails from './pages/SaleDetails'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Finance from './pages/Finance'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
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
          
          {/* Redirecionar /vendas para /financeiro */}
          <Route path="vendas" element={<Navigate to="/financeiro" replace />} />
          
          {/* Manter detalhes da venda acessível */}
          <Route path="vendas/:id" element={<SaleDetails />} />
          
          <Route path="clientes" element={<Customers />} />
          <Route path="produtos" element={<Products />} />
          <Route path="financeiro" element={<Finance />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}

export default App