-- 1. Remover registros duplicados mantendo o mais antigo por (user_id, nome)
DELETE FROM tipos_ajuste_estoque
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, nome) id
  FROM tipos_ajuste_estoque
  ORDER BY user_id, nome, created_at ASC
);

-- 2. Adicionar constraint UNIQUE para evitar duplicações futuras
ALTER TABLE tipos_ajuste_estoque
ADD CONSTRAINT unique_tipo_ajuste_per_user UNIQUE (user_id, nome);