// Persistência local do rascunho de "Nova Carga" por usuário.
// Sobrevive a F5/navegação. 100% local (não sincroniza entre dispositivos).

export interface FeiraDraftItem {
  itemId: string;
  nome: string;
  referencia: string;
  quantidade: number;
  precoUnitario: number;
  disponivelCentral: number;
  imagemUrl: string | null;
}

interface FeiraDraftPayload {
  itensCarga: FeiraDraftItem[];
  tituloCarga: string;
  savedAt: string;
}

const TTL_DAYS = 7;

function getKey(userId: string | undefined | null): string | null {
  if (!userId) return null;
  return `feira-nova-carga-draft-${userId}`;
}

export function loadFeiraDraft(userId: string | undefined | null): FeiraDraftPayload | null {
  const key = getKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeiraDraftPayload;
    if (!parsed || !Array.isArray(parsed.itensCarga)) return null;

    // TTL: descarta rascunhos antigos
    if (parsed.savedAt) {
      const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
      if (ageMs > TTL_DAYS * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveFeiraDraft(
  userId: string | undefined | null,
  itensCarga: FeiraDraftItem[],
  tituloCarga: string,
): void {
  const key = getKey(userId);
  if (!key) return;
  try {
    if (itensCarga.length === 0 && !tituloCarga.trim()) {
      localStorage.removeItem(key);
      return;
    }
    const payload: FeiraDraftPayload = {
      itensCarga,
      tituloCarga,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // quota cheia / modo privado — ignora silenciosamente
  }
}

export function clearFeiraDraft(userId: string | undefined | null): void {
  const key = getKey(userId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
