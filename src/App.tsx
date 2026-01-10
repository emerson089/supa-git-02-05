import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClientesProvider>
            <EstoqueProvider>
              <PedidosProvider>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/clientes"
                    element={
                      <ProtectedRoute>
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
                    path="/pedidos"
                    element={
                      <ProtectedRoute>
                        <NovoPedido />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pedidos/novo"
                    element={
                      <ProtectedRoute>
                        <NovoPedido />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pedidos/criados"
                    element={
                      <ProtectedRoute>
                        <PedidosCriados />
                      </ProtectedRoute>
                    }
                  />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PedidosProvider>
            </EstoqueProvider>
          </ClientesProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
}

export default App;
