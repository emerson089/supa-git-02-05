CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome text NOT NULL,
    telefone text DEFAULT ''::text NOT NULL,
    cidade text DEFAULT ''::text NOT NULL,
    estado text DEFAULT ''::text NOT NULL,
    excursao text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: estoque_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estoque_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome text NOT NULL,
    tipo text NOT NULL,
    categoria text NOT NULL,
    quantidade numeric DEFAULT 0 NOT NULL,
    unidade text NOT NULL,
    quantidade_minima numeric DEFAULT 0 NOT NULL,
    preco_unitario numeric,
    localizacao text,
    imagem_url text,
    producao_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT estoque_itens_tipo_check CHECK ((tipo = ANY (ARRAY['materia-prima'::text, 'acabado'::text])))
);


--
-- Name: estoque_movimentacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estoque_movimentacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    tipo text NOT NULL,
    quantidade numeric NOT NULL,
    motivo text,
    producao_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT estoque_movimentacoes_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text])))
);


--
-- Name: lote_custos_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lote_custos_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    producao_id uuid NOT NULL,
    metros_corte numeric(10,2) DEFAULT 0,
    valor_metro numeric(10,2) DEFAULT 0,
    preco_venda numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT check_metros_corte_range CHECK (((metros_corte IS NULL) OR ((metros_corte >= (0)::numeric) AND (metros_corte <= (100000)::numeric)))),
    CONSTRAINT check_preco_venda_range CHECK (((preco_venda IS NULL) OR ((preco_venda >= (0)::numeric) AND (preco_venda <= (10000000)::numeric)))),
    CONSTRAINT check_valor_metro_range CHECK (((valor_metro IS NULL) OR ((valor_metro >= (0)::numeric) AND (valor_metro <= (10000)::numeric))))
);


--
-- Name: lote_custos_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lote_custos_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    producao_id uuid NOT NULL,
    tipo text NOT NULL,
    descricao text NOT NULL,
    valor_unitario numeric(10,2) DEFAULT 0 NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    data_pagamento date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT check_descricao_length CHECK ((char_length(descricao) <= 200)),
    CONSTRAINT check_valor_unitario_range CHECK (((valor_unitario >= (0)::numeric) AND (valor_unitario <= (1000000)::numeric)))
);


--
-- Name: pedido_itens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedido_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pedido_id uuid NOT NULL,
    produto_id uuid,
    produto_nome text NOT NULL,
    quantidade integer DEFAULT 1 NOT NULL,
    valor_unitario numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedidos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cliente_id uuid,
    cliente_nome text NOT NULL,
    cidade text DEFAULT ''::text,
    estado text DEFAULT ''::text,
    telefone text DEFAULT ''::text,
    excursao text DEFAULT ''::text,
    status text DEFAULT 'Pendente'::text,
    status_pagamento text DEFAULT 'Pendente'::text,
    status_pedido text DEFAULT 'Pendente'::text,
    status_entrega text DEFAULT 'Pendente'::text,
    forma_pagamento text DEFAULT ''::text,
    observacoes text DEFAULT ''::text,
    total_pecas integer DEFAULT 0,
    valor_total numeric DEFAULT 0,
    estorno_realizado boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: producao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_producao text NOT NULL,
    produto_id uuid,
    modelo_nome_cache text,
    quantidade integer DEFAULT 0 NOT NULL,
    processo_atual text DEFAULT 'Corte'::text NOT NULL,
    responsavel text,
    observacoes text,
    imagem_url text,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    integrado_estoque boolean DEFAULT false NOT NULL,
    prioridade text DEFAULT 'normal'::text,
    pecas_concluidas integer DEFAULT 0,
    CONSTRAINT check_id_producao_length CHECK ((char_length(id_producao) <= 50)),
    CONSTRAINT check_modelo_nome_length CHECK (((modelo_nome_cache IS NULL) OR (char_length(modelo_nome_cache) <= 100))),
    CONSTRAINT check_observacoes_length CHECK (((observacoes IS NULL) OR (char_length(observacoes) <= 1000))),
    CONSTRAINT check_quantidade_positive CHECK (((quantidade >= 0) AND (quantidade <= 100000))),
    CONSTRAINT check_responsavel_length CHECK (((responsavel IS NULL) OR (char_length(responsavel) <= 100))),
    CONSTRAINT producao_prioridade_check CHECK ((prioridade = ANY (ARRAY['normal'::text, 'atencao'::text, 'urgente'::text])))
);


--
-- Name: producao_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producao_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    producao_id uuid NOT NULL,
    processo_anterior text,
    processo_novo text NOT NULL,
    responsavel text,
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT check_observacao_length CHECK (((observacao IS NULL) OR (char_length(observacao) <= 1000))),
    CONSTRAINT check_processo_anterior_length CHECK (((processo_anterior IS NULL) OR (char_length(processo_anterior) <= 50))),
    CONSTRAINT check_processo_novo_length CHECK ((char_length(processo_novo) <= 50)),
    CONSTRAINT check_responsavel_log_length CHECK (((responsavel IS NULL) OR (char_length(responsavel) <= 100)))
);


--
-- Name: produtos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.produtos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    referencia text NOT NULL,
    descricao text,
    imagem_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT check_descricao_produto_length CHECK (((descricao IS NULL) OR (char_length(descricao) <= 500))),
    CONSTRAINT check_nome_length CHECK ((char_length(nome) <= 100)),
    CONSTRAINT check_referencia_length CHECK ((char_length(referencia) <= 50))
);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: estoque_itens estoque_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_itens
    ADD CONSTRAINT estoque_itens_pkey PRIMARY KEY (id);


--
-- Name: estoque_movimentacoes estoque_movimentacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_movimentacoes
    ADD CONSTRAINT estoque_movimentacoes_pkey PRIMARY KEY (id);


--
-- Name: lote_custos_config lote_custos_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lote_custos_config
    ADD CONSTRAINT lote_custos_config_pkey PRIMARY KEY (id);


--
-- Name: lote_custos_config lote_custos_config_producao_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lote_custos_config
    ADD CONSTRAINT lote_custos_config_producao_id_key UNIQUE (producao_id);


--
-- Name: lote_custos_itens lote_custos_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lote_custos_itens
    ADD CONSTRAINT lote_custos_itens_pkey PRIMARY KEY (id);


--
-- Name: pedido_itens pedido_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_pkey PRIMARY KEY (id);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: producao_log producao_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producao_log
    ADD CONSTRAINT producao_log_pkey PRIMARY KEY (id);


--
-- Name: producao producao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producao
    ADD CONSTRAINT producao_pkey PRIMARY KEY (id);


--
-- Name: producao producao_user_id_producao_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producao
    ADD CONSTRAINT producao_user_id_producao_unique UNIQUE (user_id, id_producao);


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);


--
-- Name: produtos produtos_referencia_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_referencia_key UNIQUE (referencia);


--
-- Name: idx_pedido_itens_pedido_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedido_itens_pedido_id ON public.pedido_itens USING btree (pedido_id);


--
-- Name: idx_pedido_itens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedido_itens_user_id ON public.pedido_itens USING btree (user_id);


--
-- Name: idx_pedidos_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_cliente_id ON public.pedidos USING btree (cliente_id);


--
-- Name: idx_pedidos_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pedidos_user_id ON public.pedidos USING btree (user_id);


--
-- Name: clientes update_clientes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: estoque_itens update_estoque_itens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_estoque_itens_updated_at BEFORE UPDATE ON public.estoque_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lote_custos_config update_lote_custos_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lote_custos_config_updated_at BEFORE UPDATE ON public.lote_custos_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lote_custos_itens update_lote_custos_itens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lote_custos_itens_updated_at BEFORE UPDATE ON public.lote_custos_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pedidos update_pedidos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: producao update_producao_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_producao_updated_at BEFORE UPDATE ON public.producao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: produtos update_produtos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: estoque_itens estoque_itens_producao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_itens
    ADD CONSTRAINT estoque_itens_producao_id_fkey FOREIGN KEY (producao_id) REFERENCES public.producao(id) ON DELETE SET NULL;


--
-- Name: estoque_movimentacoes estoque_movimentacoes_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_movimentacoes
    ADD CONSTRAINT estoque_movimentacoes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.estoque_itens(id) ON DELETE CASCADE;


--
-- Name: estoque_movimentacoes estoque_movimentacoes_producao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estoque_movimentacoes
    ADD CONSTRAINT estoque_movimentacoes_producao_id_fkey FOREIGN KEY (producao_id) REFERENCES public.producao(id) ON DELETE SET NULL;


--
-- Name: lote_custos_config lote_custos_config_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lote_custos_config
    ADD CONSTRAINT lote_custos_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: lote_custos_itens lote_custos_itens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lote_custos_itens
    ADD CONSTRAINT lote_custos_itens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: pedido_itens pedido_itens_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;


--
-- Name: pedido_itens pedido_itens_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido_itens
    ADD CONSTRAINT pedido_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.estoque_itens(id) ON DELETE SET NULL;


--
-- Name: pedidos pedidos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: producao_log producao_log_producao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producao_log
    ADD CONSTRAINT producao_log_producao_id_fkey FOREIGN KEY (producao_id) REFERENCES public.producao(id) ON DELETE CASCADE;


--
-- Name: producao_log producao_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producao_log
    ADD CONSTRAINT producao_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: producao producao_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producao
    ADD CONSTRAINT producao_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);


--
-- Name: producao producao_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producao
    ADD CONSTRAINT producao_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: produtos produtos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: clientes Users can delete own clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own clientes" ON public.clientes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: estoque_itens Users can delete own estoque_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own estoque_itens" ON public.estoque_itens FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: estoque_movimentacoes Users can delete own estoque_movimentacoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own estoque_movimentacoes" ON public.estoque_movimentacoes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: lote_custos_config Users can delete own lote_custos_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own lote_custos_config" ON public.lote_custos_config FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: lote_custos_itens Users can delete own lote_custos_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own lote_custos_itens" ON public.lote_custos_itens FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: pedido_itens Users can delete own pedido_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own pedido_itens" ON public.pedido_itens FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: pedidos Users can delete own pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own pedidos" ON public.pedidos FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: producao Users can delete own producao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own producao" ON public.producao FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: producao_log Users can delete own producao_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own producao_log" ON public.producao_log FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: produtos Users can delete own produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own produtos" ON public.produtos FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: clientes Users can insert own clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own clientes" ON public.clientes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: estoque_itens Users can insert own estoque_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own estoque_itens" ON public.estoque_itens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: estoque_movimentacoes Users can insert own estoque_movimentacoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own estoque_movimentacoes" ON public.estoque_movimentacoes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: lote_custos_config Users can insert own lote_custos_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own lote_custos_config" ON public.lote_custos_config FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: lote_custos_itens Users can insert own lote_custos_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own lote_custos_itens" ON public.lote_custos_itens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pedido_itens Users can insert own pedido_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own pedido_itens" ON public.pedido_itens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pedidos Users can insert own pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own pedidos" ON public.pedidos FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: producao Users can insert own producao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own producao" ON public.producao FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: producao_log Users can insert own producao_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own producao_log" ON public.producao_log FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: produtos Users can insert own produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own produtos" ON public.produtos FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: clientes Users can read own clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own clientes" ON public.clientes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: estoque_itens Users can read own estoque_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own estoque_itens" ON public.estoque_itens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: estoque_movimentacoes Users can read own estoque_movimentacoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own estoque_movimentacoes" ON public.estoque_movimentacoes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: lote_custos_config Users can read own lote_custos_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own lote_custos_config" ON public.lote_custos_config FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: lote_custos_itens Users can read own lote_custos_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own lote_custos_itens" ON public.lote_custos_itens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: pedido_itens Users can read own pedido_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own pedido_itens" ON public.pedido_itens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: pedidos Users can read own pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own pedidos" ON public.pedidos FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: producao Users can read own producao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own producao" ON public.producao FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: producao_log Users can read own producao_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own producao_log" ON public.producao_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: produtos Users can read own produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own produtos" ON public.produtos FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: clientes Users can update own clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own clientes" ON public.clientes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: estoque_itens Users can update own estoque_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own estoque_itens" ON public.estoque_itens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: estoque_movimentacoes Users can update own estoque_movimentacoes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own estoque_movimentacoes" ON public.estoque_movimentacoes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: lote_custos_config Users can update own lote_custos_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own lote_custos_config" ON public.lote_custos_config FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: lote_custos_itens Users can update own lote_custos_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own lote_custos_itens" ON public.lote_custos_itens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: pedido_itens Users can update own pedido_itens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own pedido_itens" ON public.pedido_itens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: pedidos Users can update own pedidos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own pedidos" ON public.pedidos FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: producao Users can update own producao; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own producao" ON public.producao FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: producao_log Users can update own producao_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own producao_log" ON public.producao_log FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: produtos Users can update own produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own produtos" ON public.produtos FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: estoque_itens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: estoque_movimentacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: lote_custos_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lote_custos_config ENABLE ROW LEVEL SECURITY;

--
-- Name: lote_custos_itens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lote_custos_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: pedido_itens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

--
-- Name: producao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.producao ENABLE ROW LEVEL SECURITY;

--
-- Name: producao_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.producao_log ENABLE ROW LEVEL SECURITY;

--
-- Name: produtos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;