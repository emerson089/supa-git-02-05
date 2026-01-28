# Meta e Ritmo com Sazonalidade - IMPLEMENTADO ✅

## Resumo da Implementação

Sistema de Meta Mensal e Ritmo atualizado para respeitar a sazonalidade do setor de moda/jeans, usando dados históricos do mesmo mês em anos anteriores.

### O que foi implementado:

1. **Novas funções RPC no banco:**
   - `get_media_mes_anos_anteriores`: Calcula média do mesmo mês em anos anteriores
   - `get_curva_mes`: Gera curva percentual acumulada por dia do mês

2. **Nova tabela `curvas_mensais`**: Armazena curvas sazonais por usuário

3. **Lógica de Meta Sazonal** (`useDashboardData.ts`):
   - Usa média do mesmo mês em anos anteriores como base
   - Fallback para média 3 meses se não houver histórico sazonal
   - % de crescimento configurável

4. **Ritmo Sazonal** (curva não-linear):
   - % esperado baseado na curva histórica do mês
   - Comparação: % realizado vs % esperado
   - Status com tolerância ±5pp: acima / no ritmo / abaixo

5. **UI atualizada** (`Dashboard.tsx`):
   - Badge "Sazonal" quando usando dados históricos do mesmo mês
   - Duas barras de progresso: esperado vs realizado
   - Indicador visual de status com mensagens contextuais
   - Popover de configuração mostra detalhes por ano

### Resultado:
- Janeiro 2026 agora usa jan/2025 como base (R$ 231k), não média 3 meses
- Ritmo exibe "122.6% vs 89% esperado" com curva sazonal
- Status reflete posição real vs. padrão histórico do mês

