# Plano de Implementação: Novos Indicadores de Performance (KPIs)

Este plano detalha a implementação de novos indicadores estratégicos no Dashboard para resolver a falta de controle sobre cargas, financeiro e produção.

## 🎯 Objetivos
- **Controle de Cargas**: Medir a eficiência das feiras e excursões.
- **Saúde Financeira**: Visibilidade sobre Ticket Médio e Risco de Inadimplência.
- **Eficiência Industrial**: Identificar gargalos e tempo de giro.

---

## 🛠️ Fase 1: Inteligência de Dados (Hooks & RPCs)
Atualizar o hook `useDashboardData.ts` para calcular as novas métricas.

### Tarefas:
- [ ] **KPI Financeiro**: Calcular Ticket Médio (Faturamento / Pedidos Pagos).
- [ ] **KPI de Risco**: Calcular "Inadimplência Aging" (Total de pedidos PENDENTES há mais de 7 dias).
- [ ] **KPI de Carga**: Calcular Taxa de Aproveitamento média do período (% Vendido vs % Enviado).
- [ ] **KPI de Produção**: Calcular "Gargalo Crítico" (Etapa com maior volume de peças paradas).

---

## 🎨 Fase 2: Interface e Visualização (Dashboard.tsx)
Adicionar os novos cards e gráficos ao layout.

### Componentes:
- [ ] **Novos KpiCards**:
    - Ticket Médio (com variação YoY).
    - Aproveitamento de Cargas (com badge de performance).
    - Pedidos em Atraso (Aging).
- [ ] **Gráfico de Gargalos**: Mini-gráfico de barras mostrando peças por etapa de produção (foco em onde o processo trava).

---

## 🧪 Fase 3: Verificação e Testes
- [ ] Validar cálculos matemáticos com dados reais do Supabase.
- [ ] Testar responsividade no mobile (ajuste de colunas).
- [ ] Verificar se os cliques nos novos cards levam às páginas corretas (ex: clicar em Inadimplência abre Pedidos Criados filtrado por data antiga).

---

## 👥 Atribuições
- **Antigravity**: Implementação dos cálculos no hook e componentes UI.
- **User**: Validação dos conceitos de "Atraso" (7 dias é o ideal?).

---

## 📅 Próximos Passos
1. Execute `/create` para iniciar a implementação automática.
2. Ou solicite o ajuste de algum indicador específico.
