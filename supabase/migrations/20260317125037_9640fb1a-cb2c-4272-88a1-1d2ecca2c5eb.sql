ALTER TABLE transferencia_itens DROP CONSTRAINT transferencia_itens_item_id_fkey;

ALTER TABLE transferencia_itens ADD CONSTRAINT transferencia_itens_item_id_fkey FOREIGN KEY (item_id) REFERENCES estoque_itens(id) ON DELETE CASCADE;