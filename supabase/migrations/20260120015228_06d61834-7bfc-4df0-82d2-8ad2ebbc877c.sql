-- Remover políticas de leitura restritivas do bucket lotes
DROP POLICY IF EXISTS "Users can read own lotes images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for lot images" ON storage.objects;

-- Criar nova política de leitura compartilhada para usuários autenticados
CREATE POLICY "Authenticated users can read all lotes images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lotes');