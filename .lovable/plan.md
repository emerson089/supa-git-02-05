

## Problema: "Visualizar Catálogo Atual" não abre o PDF

### Diagnóstico

O link usa `target="_blank"` para abrir o PDF em uma nova aba. Dentro do preview do Lovable (iframe), popups/novas abas são frequentemente bloqueados pelo navegador. Mesmo fora do preview, alguns navegadores bloqueiam popups silenciosamente.

Além disso, a URL assinada tem validade de 1 hora — se o usuário deixar a página aberta e clicar depois, a URL já expirou e retorna erro.

### Solução

Substituir o link externo por um **preview inline do PDF** embutido na própria página, usando um `<iframe>` ou `<object>` para renderizar o PDF diretamente no card. Adicionar também um botão de download como alternativa.

### Alteração

**Arquivo:** `src/pages/ConfigCatalogo.tsx` (linhas 183-185)

Substituir o `<a>` por dois botões:
1. Um botão "Visualizar" que mostra/esconde um iframe inline com o PDF
2. Um botão "Baixar" que usa `window.open()` com uma URL assinada nova (gerada no momento do clique)

```tsx
// Adicionar estado para controlar preview
const [showPreview, setShowPreview] = useState(false);

// Função para abrir em nova aba com URL fresca
const handleDownload = async () => {
  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(FILE_PATH, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
};

// No JSX, substituir o <a> por:
<div className="flex gap-2">
  <button onClick={() => setShowPreview(!showPreview)}>Visualizar</button>
  <button onClick={handleDownload}>Abrir em nova aba</button>
</div>

// Abaixo do card de status, se showPreview && currentUrl:
<iframe src={currentUrl} className="w-full h-[70vh] rounded-xl" />
```

### Resultado
- O PDF aparece diretamente na página, sem depender de popup
- Botão alternativo gera URL fresca no momento do clique, evitando expiração
- Funciona dentro do preview do Lovable e em qualquer navegador

