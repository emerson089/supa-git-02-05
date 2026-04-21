-- Bucket privado para PDFs de pedidos
INSERT INTO storage.buckets (id, name, public)
VALUES ('pedidos-pdfs', 'pedidos-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- SELECT: usuário só lê arquivos na sua própria pasta
CREATE POLICY "Users can read own pedido PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pedidos-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- INSERT: usuário só envia arquivos na sua própria pasta
CREATE POLICY "Users can upload own pedido PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pedidos-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: necessário para upsert
CREATE POLICY "Users can update own pedido PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pedidos-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: usuário só apaga arquivos na sua própria pasta
CREATE POLICY "Users can delete own pedido PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pedidos-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);