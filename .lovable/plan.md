

## Plano: Melhorias no Modal "Registrar Retorno" da Feira

### Problemas Identificados

Analisando o código do modal em `src/pages/Feira.tsx` (linhas 986-1120):

1. **Nomes dos produtos truncados**: O grid atual usa `truncate` (CSS) que corta o texto com "..."
2. **Referência não exibida**: A referência (código numérico após "-") existe no nome mas não é destacada
3. **Foto pequena no mobile**: A imagem está com `w-12 h-12` (48px), que é pequeno para tela touch

### Solução Proposta

#### 1. Novo Layout de Grid - Mobile

Mudar de layout horizontal (uma linha) para layout com **2 linhas por produto**:

| Atual (horizontal) | Proposto (2 linhas) |
|-------------------|---------------------|
| `[Foto 48px][Nome truncado][Env][Ret][Vend]` | **Linha 1:** `[Foto 64px][Nome completo + Ref]` |
| Nome cortado, difícil identificar | **Linha 2:** `[Env][Ret][Vend] alinhado abaixo` |

#### 2. Exibir Nome Completo + Referência em Destaque

- **Nome do modelo**: Exibir em até 2 linhas (`line-clamp-2`)
- **Referência**: Extrair do nome (padrão "Nome - 170") e mostrar como Badge separado

Exemplo:
```
┌──────────────────────────────────────────┐
│ [FOTO]  Short Alfaiataria com         │
│  64x64  fechamento zíper   [Ref: 385]   │
├──────────────────────────────────────────┤
│      Enviado: 60  │ Ret: [___] │ V: 60  │
└──────────────────────────────────────────┘
```

#### 3. Aumentar Foto no Mobile

- **De**: `w-12 h-12` (48px)
- **Para**: `w-16 h-16` (64px)

### Alterações Técnicas

#### Arquivo: `src/pages/Feira.tsx`

**1. Criar função utilitária para extrair referência** (replicar padrão existente):
```typescript
function extrairReferencia(nome: string): string | null {
  const match = nome.match(/\s*-\s*(\d+)$/);
  return match ? match[1] : null;
}
```

**2. Alterar grid para layout 2 linhas no mobile**:

De:
```typescript
grid-cols-[52px_1fr_44px_64px_64px]
```

Para:
```typescript
// Mobile: 2 linhas verticais
// Desktop: manter horizontal
```

**3. Código JSX proposto para cada item**:
```tsx
// Linha 1: Imagem + Nome/Referência
<div className="flex items-start gap-3">
  <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
    <LotImage src={...} alt={...} eager />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-medium leading-tight line-clamp-2">
      {nomesSemReferencia}
    </p>
    {referencia && (
      <Badge variant="outline" className="mt-1 text-xs">
        Ref: {referencia}
      </Badge>
    )}
  </div>
</div>

// Linha 2: Enviado + Retorno + Vendido
<div className="flex items-center justify-between gap-2 mt-2">
  <span>Enviado: <strong>{quantidadeEnviada}</strong></span>
  <Input ... /> {/* Retorno */}
  <span>Vendido: <strong>{vendido}</strong></span>
</div>
```

### Resultado Visual Esperado

```
┌────────────────────────────────────────────────────────┐
│ 📦 Registrar Retorno                              ✕   │
├────────────────────────────────────────────────────────┤
│ 8 de 8 produto(s)      [🔍 Buscar modelo...]          │
├────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐  │
│ │ ┌────┐ Short cinto encapado                      │  │
│ │ │    │ sarja com bordado     [Ref: 124]          │  │
│ │ │64px│                                           │  │
│ │ └────┘                                           │  │
│ │ Enviado: 108    [Retorno: ___]    Vendido: 108   │  │
│ └──────────────────────────────────────────────────┘  │
│                                                        │
│ ┌──────────────────────────────────────────────────┐  │
│ │ ┌────┐ Calça Alfaiataria Modelagem              │  │
│ │ │    │ reta cintura alta     [Ref: 280]          │  │
│ │ │64px│                                           │  │
│ │ └────┘                                           │  │
│ │ Enviado: 30     [Retorno: ___]    Vendido: 30    │  │
│ └──────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│   8 item(s) pendente(s) de preenchimento              │
│   Enviado: 636  Retorno: 0  Vendido: 636              │
│  [  Cancelar  ]           [  ✓ Confirmar  ]           │
└────────────────────────────────────────────────────────┘
```

### Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| **Tamanho da foto** | 48x48px | 64x64px |
| **Nome do produto** | 1 linha truncada | 2 linhas visíveis |
| **Referência** | Escondida no nome | Badge destacado |
| **Layout** | 1 linha horizontal | 2 linhas (nome/valores) |
| **Identificação** | Difícil | Fácil e rápida |

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Feira.tsx` | Refatorar layout do modal de retorno (linhas 1013-1086) |

