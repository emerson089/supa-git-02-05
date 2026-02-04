
Contexto e causa raiz (confirmado)
- O erro “violates check constraint transferencias_status_check” acontece porque a tabela transferencias só aceita status:
  - em_andamento, concluida, cancelada, estornada
  (isso está definido no CHECK transferencias_status_check).
- Porém, a função do backend rpc_criar_transferencia (atual) ainda está inserindo status = 'pendente' (ver migration 20260204144905... linha 56).
- Resultado: ao tentar criar a transferência (Central → Loja) via modal, o INSERT falha imediatamente com a constraint.

Objetivo
- Fazer com que toda transferência “pendente” use o status correto do banco: em_andamento.
- Ajustar também concluir/cancelar e a UI para reconhecer em_andamento como “Pendente”, mantendo labels amigáveis.

Plano de correção

1) Backend (migração) — corrigir status usado nas RPCs
1.1 Criar uma nova migration para substituir as funções:
- rpc_criar_transferencia
  - Manter assinatura com p_observacoes (já existente).
  - Trocar no INSERT: status de 'pendente' para 'em_andamento'.
  - Exemplo (trecho):
    INSERT INTO transferencias (..., tipo, status, motivo, observacoes)
    VALUES (..., 'transferencia', 'em_andamento', p_motivo, p_observacoes);

- rpc_concluir_transferencia
  - Trocar a validação:
    IF v_transferencia.status != 'em_andamento' THEN ...
  - Mantém atualização final para status = 'concluida'.

- rpc_cancelar_transferencia
  - Trocar a validação:
    IF v_transferencia.status != 'em_andamento' THEN ...
  - Mantém update final para status = 'cancelada'.

1.2 (Opcional, mas recomendado) Ajuste de mensagem de erro
- Onde hoje diz “não está pendente…”, trocar para “não está em andamento…” para ficar consistente com o banco.

2) Frontend — padronizar “Pendente” = em_andamento
A UI hoje usa 'pendente' em vários pontos (filtros, badges e regras de habilitar ações). Depois que o backend passar a criar em_andamento, precisamos refletir isso na interface.

2.1 Atualizar tipos e labels de status (filtros)
Arquivo: src/components/transferencias/FiltrosTransferencias.tsx
- Trocar StatusTransferencia de:
  - 'pendente' | 'concluida' | 'cancelada'
  para:
  - 'em_andamento' | 'concluida' | 'cancelada'
- Atualizar STATUS_LABELS para mapear:
  - em_andamento → "Pendente"

2.2 Atualizar badges/config de status na tela de Transferências
Arquivo: src/pages/Transferencias.tsx
- Atualizar STATUS_CONFIG para usar em_andamento no lugar de pendente:
  - em_andamento: { label: 'Pendente', ... }

2.3 Atualizar modal de detalhes (ações só quando “pendente/em_andamento”)
Arquivo: src/components/transferencias/DetalhesTransferenciaModal.tsx
- STATUS_CONFIG: trocar chave pendente por em_andamento (label continua “Pendente”)
- Regra de habilitar edição/ações:
  - const isPendente = transferencia.status === 'em_andamento';

2.4 Atualizar hook que só permite editar quando está pendente
Arquivo: src/hooks/useTransferencias.ts
- Em useAtualizarTransferencia:
  - .eq('status', 'pendente') → .eq('status', 'em_andamento')

2.5 (Melhoria rápida) Ajustar useCriarTransferencia para não confundir motivo/observações
Arquivo: src/hooks/useTransferencias.ts + src/pages/Transferencias.tsx (onde chama)
- Hoje useCriarTransferencia manda p_motivo = observacoes.
- Ajustar para:
  - receber motivo (enum) e observacoes (texto) separadamente
  - enviar p_motivo e p_observacoes corretamente
Isso não é a causa do erro atual, mas evita inconsistência e reduz chance de novos constraints.

3) (Segurança) Verificação/limpeza de dados antigos (se existirem)
- Rodar um SELECT para verificar se existe alguma transferência com status = 'pendente'.
- Se existir (cenário improvável, mas possível em ambientes antigos), rodar UPDATE para:
  - pendente → em_andamento
Observação: isso é “alteração de dados”, então faremos como operação de dados separada (não como mudança estrutural).

4) Validação (checklist de aceite)
- No /transferencias:
  - Abrir o modal “Central → Loja …”
  - Selecionar produto + quantidade + motivo (dropdown)
  - Transferir: não deve mais ocorrer erro de transferencias_status_check
  - A nova transferência deve aparecer na lista como “Pendente” (status em_andamento)
- Abrir Detalhes:
  - Enquanto em_andamento: deve permitir editar motivo/observações e mostrar botões Concluir/Cancelar
  - Concluir: status vira concluida
  - Cancelar: status vira cancelada

Arquivos impactados
- Backend migration: supabase/migrations/XXXX_fix_transferencias_status.sql (nova)
- Frontend:
  - src/components/transferencias/FiltrosTransferencias.tsx
  - src/pages/Transferencias.tsx
  - src/components/transferencias/DetalhesTransferenciaModal.tsx
  - src/hooks/useTransferencias.ts

Resultado esperado
- Transferência do estoque central passa a criar registro com status válido (em_andamento), eliminando o erro da constraint.
- UI continua mostrando “Pendente” para o usuário, mas internamente usa o status correto do banco.
