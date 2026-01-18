import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { ClientesProvider } from "@/contexts/ClientesContext";
import { EstoqueProvider } from "@/contexts/EstoqueContext";
import { PedidosProvider } from "@/contexts/PedidosContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NovoPedido from "./pages/NovoPedido";
import PedidosCriados from "./pages/PedidosCriados";
import Clientes from "./pages/Clientes";
import Estoque from "./pages/Estoque";
import Feira from "./pages/Feira";
import Transferencias from "./pages/Transferencias";
import Auth from "./pages/Auth";
import AlterarSenha from "./pages/AlterarSenha";
import ConfigUsuarios from "./pages/ConfigUsuarios";
import Ajuda from "./pages/Ajuda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RoleProvider>
            <ClientesProvider>
              <EstoqueProvider>
                <PedidosProvider>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route
                      path="/alterar-senha"
                      element={
                        <ProtectedRoute>
                          <AlterarSenha />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/configuracoes/usuarios"
                      element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <ConfigUsuarios />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <Dashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Navigate to="/pedidos/novo" replace />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/producao"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <Index />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/clientes"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <Clientes />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/estoque"
                      element={
                        <ProtectedRoute>
                          <Estoque />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/feira"
                      element={
                        <ProtectedRoute>
                          <Feira />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/transferencias"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <Transferencias />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pedidos"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <NovoPedido />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pedidos/novo"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <NovoPedido />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/pedidos/criados"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <PedidosCriados />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/ajuda"
                      element={
                        <ProtectedRoute>
                          <Ajuda />
                        </ProtectedRoute>
                      }
                    />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </PedidosProvider>
              </EstoqueProvider>
            </ClientesProvider>
          </RoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
}

export default App;
