import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { ClientesProvider } from "@/contexts/ClientesContext";
import { EstoqueProvider } from "@/contexts/EstoqueContext";
import { PedidosProvider } from "@/contexts/PedidosContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBasedRedirect } from "@/components/RoleBasedRedirect";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NovoPedido from "./pages/NovoPedido";
import PedidosCriados from "./pages/PedidosCriados";
import Clientes from "./pages/Clientes";
import Estoque from "./pages/Estoque";
import Feira from "./pages/Feira";
import Auth from "./pages/Auth";
import AlterarSenha from "./pages/AlterarSenha";
import ConfigUsuarios from "./pages/ConfigUsuarios";
import ConfigTiposAjuste from "./pages/ConfigTiposAjuste";
import ConfigExcursoes from "./pages/ConfigExcursoes";
import ConfigCustosPadrao from "./pages/ConfigCustosPadrao";
import ConfigCatalogo from "./pages/ConfigCatalogo";
import ConfigNotificacoes from "./pages/ConfigNotificacoes";
import Ajuda from "./pages/Ajuda";
import NotFound from "./pages/NotFound";
import PecasEmConserto from "./pages/PecasEmConserto";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000, // 15 segundos padrão - dados ficam "frescos" por 15s
      refetchOnWindowFocus: false, // Não refetch automático ao focar janela
      retry: 1, // Apenas 1 retry em caso de erro
    },
  },
});

// Wrapper: EstoqueProvider apenas para rotas que precisam de estoque
function EstoqueLayout() {
  return (
    <EstoqueProvider>
      <Outlet />
    </EstoqueProvider>
  );
}

// Wrapper: ClientesProvider + PedidosProvider + EstoqueProvider para rotas de pedidos
function PedidosLayout() {
  return (
    <ClientesProvider>
      <EstoqueProvider>
        <PedidosProvider>
          <Outlet />
        </PedidosProvider>
      </EstoqueProvider>
    </ClientesProvider>
  );
}

// Wrapper: ClientesProvider para rota de clientes
function ClientesLayout() {
  return (
    <ClientesProvider>
      <Outlet />
    </ClientesProvider>
  );
}

function App() {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RoleProvider>
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
                path="/configuracoes/tipos-ajuste"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <ConfigTiposAjuste />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes/excursoes"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <ConfigExcursoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes/custos-padrao"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <ConfigCustosPadrao />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes/catalogo"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <ConfigCatalogo />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes/notificacoes"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                    <ConfigNotificacoes />
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
                    <RoleBasedRedirect />
                  </ProtectedRoute>
                }
              />

              {/* Rotas com EstoqueProvider */}
              <Route element={<EstoqueLayout />}>
                <Route
                  path="/producao"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/producao/consertos"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                      <PecasEmConserto />
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
              </Route>

              {/* Rotas com ClientesProvider */}
              <Route element={<ClientesLayout />}>
                <Route
                  path="/clientes"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                      <Clientes />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Rotas com PedidosProvider (inclui Clientes + Estoque) */}
              <Route element={<PedidosLayout />}>
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
              </Route>

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
          </RoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
}

export default App;
