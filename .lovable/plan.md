

## Clientes CRM: Preservacao de Estado, Priorizacao Inteligente e Marcador de Contato

### Visao Geral

Implementar 4 melhorias na pagina de Clientes para manter contexto do usuario, priorizar contatos inteligentemente, registrar interacoes e adicionar acoes rapidas -- tudo com minimo impacto no backend.

---

### 1. Preservacao de Estado com localStorage

**O que muda:** Ao sair e voltar na pagina de Clientes, os filtros, busca, ordenacao e pagina serao lembrados automaticamente.

**Como funciona:**
- Salvar no `localStorage` (chave `clientes_state`): filtro ativo, ordenacao, pagina atual e texto de busca
- Ao montar a pagina, restaurar esses valores do `localStorage` ao inves de comecar em "Todos / Nome A-Z / Pagina 1"
- Cada mudanca de filtro/busca/pagina atualiza o `localStorage` automaticamente
- Zero chamadas extras ao backend

**Arquivo:** `src/pages/Clientes.tsx` -- substituir os `useState` iniciais por valores restaurados do `localStorage`

---

### 2. Clientes Inativos com Score de Prioridade

**O que muda:** Quando o filtro "Inativos" estiver ativo, os clientes serao ordenados por um score de prioridade de contato (quem precisa ser contatado primeiro aparece no topo).

**Formula do score (calculado localmente no frontend):**

```text
score = (diasSemComprar * 2) + (totalComprado / 100) + (ticketMedio * 0.5) - (cancelamentos * 50)
```

- **diasSemComprar** (peso 2): quanto mais tempo sem comprar, maior prioridade
- **totalComprado** (peso positivo): clientes que gastaram mais merecem atencao
- **ticketMedio**: complementa o valor do cliente
- **cancelamentos** (peso negativo): clientes com muitos cancelamentos tem prioridade reduzida

**Niveis visuais de prioridade:**
- **Alta** (score > 200): borda esquerda vermelha + badge "Prioridade Alta"
- **Media** (score 100-200): borda esquerda amarela + badge "Prioridade Media"
- **Baixa** (score < 100): sem destaque especial

**Como funciona:**
- O score e calculado a partir dos dados CRM que ja existem (`useClientesCRMBatch`)
- A ordenacao por prioridade e feita localmente (sem nova query)
- Quando o marcador de contato for ativado, o score e reduzido temporariamente

**Arquivos:**
- `src/hooks/useClientePrioridade.ts` (novo) -- funcao pura que calcula score a partir de `ClienteCRMBatchStats`
- `src/pages/Clientes.tsx` -- ordenar lista localmente quando filtro = "inativo" e exibir badges de prioridade

---

### 3. Marcador de Contato (localStorage)

**O que muda:** Botao "Marcar como Contatado" no card do cliente. Registra data e canal do ultimo contato. Clientes contatados recentemente tem prioridade reduzida.

**Dados salvos no localStorage** (chave `clientes_contatos`):

```text
{
  [clienteId]: {
    data: "2026-02-24T15:30:00",
    canal: "whatsapp" | "ligacao" | "outro"
  }
}
```

**Regras:**
- Se contatado ha menos de 7 dias: score de prioridade reduzido em 80%
- Badge visual "Contatado ha X dias" aparece no card
- Ao clicar em "Enviar WhatsApp" e confirmar o envio, o marcador e atualizado automaticamente para canal "whatsapp"
- Botao manual "Marcar como Contatado" com opcao de canal (WhatsApp, Ligacao, Outro)
- Tudo em localStorage, zero requests ao backend

**Arquivos:**
- `src/hooks/useClienteContatos.ts` (novo) -- hook que le/salva contatos no localStorage
- `src/pages/Clientes.tsx` -- integrar marcador visual no card
- `src/components/clientes/WhatsAppButton.tsx` -- ao enviar, marcar automaticamente como contatado via callback

---

### 4. UX e Acoes Rapidas no Card

**O que muda:** Acoes diretas visiveis no card + destaque visual de prioridade.

**Acoes no card (sempre visiveis, nao so no hover):**
- Botao WhatsApp (ja existe)
- Botao Ligar (abre `tel:` com o telefone)
- Botao "Marcar como Contatado" (icone de check) -- abre mini-menu com opcoes de canal

**Destaques visuais:**
- Borda esquerda colorida por prioridade (vermelho/amarelo/neutro) -- apenas quando filtro "Inativos" ativo
- Badge "Contatado ha X dias" quando aplicavel
- Badge "Prioridade Alta/Media" quando filtro "Inativos" ativo

**Arquivos:**
- `src/pages/Clientes.tsx` -- atualizar `ClienteCard` com novas acoes e indicadores visuais

---

### Detalhes Tecnicos

#### Novos arquivos

| Arquivo | Descricao |
|---|---|
| `src/hooks/useClientePrioridade.ts` | Funcao pura `calcularPrioridade(stats, contato)` que retorna score numerico e nivel (alta/media/baixa) |
| `src/hooks/useClienteContatos.ts` | Hook com `getContato(id)`, `marcarContato(id, canal)`, `contatosMap` -- tudo localStorage |

#### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/Clientes.tsx` | Restaurar estado do localStorage; ordenar por prioridade no filtro Inativos; adicionar acoes rapidas (ligar, marcar contatado); destaque visual de prioridade e contato |
| `src/components/clientes/WhatsAppButton.tsx` | Aceitar callback `onContatoRegistrado` para marcar automaticamente apos envio |

#### Impacto no backend
- **Zero** novas queries
- **Zero** novas tabelas
- **Zero** novas migrations
- Tudo funciona com dados CRM ja carregados + localStorage

#### Compatibilidade
- O localStorage e por usuario/navegador -- se trocar de dispositivo, os marcadores de contato nao acompanham (isso e intencional para evitar consumo de Cloud)
- A preservacao de estado tambem e local ao navegador

