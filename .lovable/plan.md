

## Correção: Status "NO CARRO" não atualiza

### Problema
A coluna `notificado_no_carro` **não existe** na tabela `pedidos` do banco de dados. Quando o status de entrega é alterado para "NO CARRO", o código envia o WhatsApp com sucesso e depois tenta salvar `notificado_no_carro = true` junto com `status_entrega = 'NO CARRO'`. Como a coluna não existe, **toda a atualização falha** — o status não muda.

### Solução

**1. Migração SQL** — Adicionar a coluna faltante:
```sql
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS notificado_no_carro boolean DEFAULT false;
```

**2. Nenhuma mudança de código necessária** — o código já está correto, só faltava a coluna no banco.

