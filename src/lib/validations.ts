import { z } from 'zod';

// ============================================
// Cliente validation schema
// ============================================
export const ClienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  telefone: z
    .string()
    .trim()
    .min(1, 'Telefone é obrigatório')
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .regex(/^[\d\s()+-]+$/, 'Telefone deve conter apenas números e caracteres válidos'),
  cidade: z
    .string()
    .trim()
    .max(100, 'Cidade deve ter no máximo 100 caracteres')
    .default(''),
  estado: z
    .string()
    .trim()
    .max(2, 'Estado deve ter no máximo 2 caracteres')
    .regex(/^[A-Za-z]*$/, 'Estado deve conter apenas letras')
    .default(''),
  excursao: z
    .string()
    .trim()
    .max(200, 'Excursão deve ter no máximo 200 caracteres')
    .default('')
});

export type ClienteFormData = z.infer<typeof ClienteSchema>;

// ============================================
// Estoque Item validation schema
// ============================================
export const EstoqueItemSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome deve ter no máximo 200 caracteres'),
  categoria: z
    .string()
    .trim()
    .max(100, 'Categoria deve ter no máximo 100 caracteres')
    .optional()
    .or(z.literal('')),
  quantidade: z
    .number()
    .min(0, 'Quantidade não pode ser negativa')
    .max(1000000, 'Quantidade máxima é 1.000.000'),
  unidade: z
    .string()
    .trim()
    .max(50, 'Unidade deve ter no máximo 50 caracteres')
    .optional()
    .or(z.literal('')),
  quantidadeMinima: z
    .number()
    .min(0, 'Quantidade mínima não pode ser negativa')
    .max(1000000, 'Quantidade mínima máxima é 1.000.000'),
  precoUnitario: z
    .number()
    .min(0, 'Preço não pode ser negativo')
    .max(1000000, 'Preço máximo é R$ 1.000.000'),
  localizacao: z
    .string()
    .trim()
    .max(200, 'Localização deve ter no máximo 200 caracteres')
    .optional()
    .or(z.literal(''))
});

export type EstoqueItemFormData = z.infer<typeof EstoqueItemSchema>;

// Novo Modelo Acabado schema
export const NovoModeloAcabadoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome deve ter no máximo 200 caracteres'),
  referencia: z
    .string()
    .trim()
    .max(50, 'Referência deve ter no máximo 50 caracteres')
    .optional()
    .or(z.literal('')),
  quantidade: z
    .number()
    .int('Quantidade deve ser um número inteiro')
    .min(1, 'Quantidade deve ser pelo menos 1')
    .max(100000, 'Quantidade máxima é 100.000'),
  precoVenda: z
    .number()
    .min(0, 'Preço não pode ser negativo')
    .max(100000, 'Preço máximo é R$ 100.000'),
  imagemUrl: z
    .string()
    .max(500, 'Caminho da imagem deve ter no máximo 500 caracteres')
    .optional()
    .or(z.literal(''))
});

export type NovoModeloAcabadoFormData = z.infer<typeof NovoModeloAcabadoSchema>;

// ============================================
// Pedido Item validation schema
// ============================================
export const PedidoItemSchema = z.object({
  produtoId: z
    .string()
    .min(1, 'Selecione um produto'),
  quantidade: z
    .number()
    .int('Quantidade deve ser um número inteiro')
    .min(1, 'Quantidade deve ser pelo menos 1')
    .max(100000, 'Quantidade máxima é 100.000'),
  valorUnitario: z
    .number()
    .min(0, 'Valor não pode ser negativo')
    .max(1000000, 'Valor máximo é R$ 1.000.000')
});

export type PedidoItemFormData = z.infer<typeof PedidoItemSchema>;

// ============================================
// Production (Producao) validation schemas
// ============================================
export const ProducaoFormSchema = z.object({
  id_producao: z
    .string()
    .min(1, 'Referência é obrigatória')
    .max(50, 'Referência deve ter no máximo 50 caracteres')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Referência deve conter apenas letras, números, hífens e underscores'),
  modelo_nome_cache: z
    .string()
    .min(1, 'Nome do modelo é obrigatório')
    .max(200, 'Nome do modelo deve ter no máximo 200 caracteres'),
  quantidade: z
    .number()
    .int('Quantidade deve ser um número inteiro')
    .min(0, 'Quantidade não pode ser negativa')
    .max(100000, 'Quantidade máxima é 100.000'),
  processo_atual: z.string().min(1, 'Etapa atual é obrigatória'),
  responsavel: z
    .string()
    .max(100, 'Nome do responsável deve ter no máximo 100 caracteres')
    .optional()
    .or(z.literal('')),
  observacoes: z
    .string()
    .max(1000, 'Observações devem ter no máximo 1000 caracteres')
    .optional()
    .or(z.literal('')),
  imagem_url: z
    .string()
    .max(500, 'Caminho da imagem deve ter no máximo 500 caracteres')
    .optional()
    .or(z.literal(''))
});

export type ProducaoFormData = z.infer<typeof ProducaoFormSchema>;

// ============================================
// Cost item validation schema
// ============================================
export const CustoItemSchema = z.object({
  tipo: z.string().min(1, 'Tipo é obrigatório').max(50, 'Tipo deve ter no máximo 50 caracteres'),
  descricao: z
    .string()
    .min(1, 'Descrição é obrigatória')
    .max(200, 'Descrição deve ter no máximo 200 caracteres'),
  valor_unitario: z
    .number()
    .min(0, 'Valor não pode ser negativo')
    .max(1000000, 'Valor máximo é R$ 1.000.000')
});

export type CustoItemData = z.infer<typeof CustoItemSchema>;

// ============================================
// Cost config validation schema
// ============================================
export const CustoConfigSchema = z.object({
  metros_corte: z
    .number()
    .min(0, 'Metros não pode ser negativo')
    .max(100000, 'Metros máximo é 100.000'),
  valor_metro: z
    .number()
    .min(0, 'Valor por metro não pode ser negativo')
    .max(10000, 'Valor por metro máximo é R$ 10.000'),
  preco_venda: z
    .number()
    .min(0, 'Preço de venda não pode ser negativo')
    .max(100000, 'Preço de venda máximo é R$ 100.000')
});

export type CustoConfigData = z.infer<typeof CustoConfigSchema>;

// ============================================
// Produto validation schema
// ============================================
export const ProdutoSchema = z.object({
  nome: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome deve ter no máximo 200 caracteres'),
  referencia: z
    .string()
    .min(1, 'Referência é obrigatória')
    .max(50, 'Referência deve ter no máximo 50 caracteres')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Referência deve conter apenas letras, números, hífens e underscores'),
  descricao: z
    .string()
    .max(1000, 'Descrição deve ter no máximo 1000 caracteres')
    .optional()
    .or(z.literal('')),
  imagem_url: z
    .string()
    .max(500, 'Caminho da imagem deve ter no máximo 500 caracteres')
    .optional()
    .or(z.literal(''))
});

export type ProdutoData = z.infer<typeof ProdutoSchema>;

// ============================================
// Helper functions
// ============================================

// Helper function to sanitize filename for storage uploads
export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts and special characters
  const sanitized = fileName
    .replace(/[\/\\:*?"<>|]/g, '') // Remove special chars
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase();
  
  // Ensure the file has an extension
  const parts = sanitized.split('.');
  if (parts.length < 2 || parts[parts.length - 1].length > 10) {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  
  return sanitized;
}

// Helper to get validation error messages
export function getValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.errors) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

// Helper to validate and return first error message
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = getValidationErrors(result.error);
  const firstError = Object.values(errors)[0] || 'Dados inválidos';
  return { success: false, error: firstError, errors };
}
