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
import ConfigCobrancas from "./pages/ConfigCobrancas";
import Ajuda from "./pages/Ajuda";
import NotFound from "./pages/NotFound";
import PecasEmConserto from "./pages/PecasEmConserto";
import Comprovantes from "./pages/Comprovantes";
import Transferencias from "./pages/Transferencias";
import ConfigLocais from "./pages/ConfigLocais";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000, // 15 segundos padrão - dados ficam "frescos" por 15s
      refetchOnWindowFocus: false, // Não refetch automático ao focar janela
      retry: 1, // Apenas 1 retry em caso de erro
    },
  },
});

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
                      path="/configuracoes/cobrancas"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <ConfigCobrancas />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/configuracoes/locais"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <ConfigLocais />
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
                      path="/comprovantes"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <Comprovantes />
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

                    {/* Rotas de Produção */}
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
                      path="/transferencias"
                      element={
                        <ProtectedRoute>
                          <Transferencias />
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

                    {/* Rotas de Clientes */}
                    <Route
                      path="/clientes"
                      element={
                        <ProtectedRoute allowedRoles={['admin', 'gerente']}>
                          <Clientes />
                        </ProtectedRoute>
                      }
                    />

                    {/* Rotas de Pedidos */}
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
