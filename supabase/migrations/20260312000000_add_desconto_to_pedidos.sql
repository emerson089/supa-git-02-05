-- Adiciona coluna de desconto à tabela pedidos
ALTER TABLE "public"."pedidos" ADD COLUMN "desconto" numeric DEFAULT 0;

-- Comentário para documentação interna
COMMENT ON COLUMN "public"."pedidos"."desconto" IS 'Valor do desconto manual aplicado ao pedido (Informação Interna)';
