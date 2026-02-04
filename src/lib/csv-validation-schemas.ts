import { z } from 'zod';

// ==================== PEDIDOS ====================
const STATUS_PAGAMENTO_VALUES = ['PAGO', 'PENDENTE', 'CANCELADO', 'INCOMPLETO', 'PEND. ENTREGA', 'GOLPE CANCELADO'] as const;
const STATUS_PEDIDO_VALUES = ['SEPARADO', 'NÃO SEPARADO', 'AMANHÃ', 'INCOMPLETO', 'CANCELADO', 'GOLPE CANCELADO'] as const;
const STATUS_ENTREGA_VALUES = ['ENTREGUE', 'RETIRADA', 'PRÓX. SEMANA', 'PEND. ENTREGA', 'NÃO ENTREGOU', 'ENTREGOU ERRADO', 'CANCELADO'] as const;

export const PedidoCSVRowSchema = z.object({
  data: z.string().max(50, 'Data muito longa'),
  cliente: z.string().min(1, 'Cliente obrigatório').max(255, 'Nome do cliente muito longo'),
  qtdTotal: z.number().int().min(0, 'Quantidade não pode ser negativa').max(100000, 'Quantidade muito alta'),
  valorTotal: z.number().min(0, 'Valor não pode ser negativo').max(10000000, 'Valor muito alto'),
  statusPagamento: z.string().max(50, 'Status pagamento muito longo'),
  statusPedido: z.string().max(50, 'Status pedido muito longo'),
  statusEntrega: z.string().max(50, 'Status entrega muito longo'),
});

export type ValidatedPedidoCSVRow = z.infer<typeof PedidoCSVRowSchema>;

// ==================== CLIENTES ====================
export const ClienteCSVRowSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(255, 'Nome muito longo'),
  telefone: z.string().max(50, 'Telefone muito longo').optional().default(''),
  cidade: z.string().max(100, 'Cidade muito longa').optional().default(''),
  estado: z.string().max(50, 'Estado muito longo').optional().default(''),
  excursao: z.string().max(100, 'Excursão muito longa').optional().default(''),
  datahora: z.string().max(50, 'Data muito longa').optional(),
});

export type ValidatedClienteCSVRow = z.infer<typeof ClienteCSVRowSchema>;

// ==================== CUSTOS DE PRODUÇÃO ====================
const VALID_TIPOS_CUSTO = ['Material', 'Facção/Costura', 'Lavanderia', 'Acabamento', 'Aviamentos', 'Transporte', 'Outros'] as const;

export const CustoCSVRowSchema = z.object({
  referencia: z.string().min(1, 'Referência obrigatória').max(50, 'Referência muito longa'),
  modelo: z.string().max(255, 'Modelo muito longo').optional().default(''),
  quantidade: z.number().int().min(0, 'Quantidade inválida').max(100000, 'Quantidade muito alta').optional().default(0),
  metrosTecido: z.number().min(0, 'Metros inválidos').max(100000, 'Metros muito alto').optional().default(0),
  valorMetro: z.number().min(0, 'Valor/metro inválido').max(10000, 'Valor/metro muito alto').optional().default(0),
  precoVenda: z.number().min(0, 'Preço venda inválido').max(100000, 'Preço venda muito alto').optional().default(0),
  tipoCusto: z.string().max(50, 'Tipo custo muito longo').optional().default(''),
  descricaoCusto: z.string().max(500, 'Descrição muito longa').optional().default(''),
  valorUnitario: z.number().min(0, 'Valor unitário inválido').max(100000, 'Valor unitário muito alto').optional().default(0),
  pago: z.boolean().optional().default(false),
  dataPagamento: z.string().max(20, 'Data pagamento muito longa').optional().default(''),
});

export type ValidatedCustoCSVRow = z.infer<typeof CustoCSVRowSchema>;

// Validate tipo custo against allowed values
export function validateTipoCusto(tipo: string): boolean {
  if (!tipo) return true; // Empty is allowed
  return VALID_TIPOS_CUSTO.includes(tipo as typeof VALID_TIPOS_CUSTO[number]);
}

// ==================== MODELOS (ESTOQUE) ====================
export const ModeloCSVRowSchema = z.object({
  referencia: z.string().max(50, 'Referência muito longa').optional().default(''),
  nome: z.string().max(255, 'Nome muito longo').optional().default(''),
  quantidade: z.number().int().min(0, 'Quantidade inválida').max(1000000, 'Quantidade muito alta').optional().default(0),
  preco: z.number().min(0, 'Preço inválido').max(100000, 'Preço muito alto').optional().default(0),
});

export type ValidatedModeloCSVRow = z.infer<typeof ModeloCSVRowSchema>;

// ==================== LOTES DE PRODUÇÃO ====================
const VALID_PRIORITIES = ['normal', 'atencao', 'urgente'] as const;

export const ProducaoCSVRowSchema = z.object({
  referencia: z.string().max(50, 'Referência muito longa').optional().default(''),
  modelo: z.string().max(255, 'Modelo muito longo').optional().default(''),
  quantidade: z.number().int().min(1, 'Quantidade deve ser maior que 0').max(100000, 'Quantidade muito alta'),
  etapa: z.string().max(50, 'Etapa muito longa').optional().default('Corte'),
  responsavel: z.string().max(100, 'Responsável muito longo').optional().default(''),
  prioridade: z.string().max(20, 'Prioridade muito longa').optional().default('normal'),
  observacoes: z.string().max(1000, 'Observações muito longas').optional().default(''),
});

export type ValidatedProducaoCSVRow = z.infer<typeof ProducaoCSVRowSchema>;

// ==================== EXCURSÕES ====================
export const ExcursaoCSVRowSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(255, 'Nome muito longo'),
  taxa: z.number().min(0, 'Taxa inválida').max(10000, 'Taxa muito alta'),
});

export type ValidatedExcursaoCSVRow = z.infer<typeof ExcursaoCSVRowSchema>;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Validates a single row and returns the result with error messages
 */
export function validateCSVRow<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  rowIndex: number
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(
    (err) => `Linha ${rowIndex + 1}: ${err.path.join('.')} - ${err.message}`
  );
  
  return { success: false, errors };
}

/**
 * Validates an array of rows and returns valid data + all errors
 */
export function validateCSVRows<T extends z.ZodSchema>(
  schema: T,
  rows: unknown[],
  startIndex = 1
): { validRows: z.infer<T>[]; errors: string[] } {
  const validRows: z.infer<T>[] = [];
  const errors: string[] = [];
  
  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      validRows.push(result.data);
    } else {
      const rowErrors = result.error.errors.map(
        (err) => `Linha ${startIndex + index + 1}: ${err.path.join('.') || 'campo'} - ${err.message}`
      );
      errors.push(...rowErrors);
    }
  });
  
  return { validRows, errors };
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 * while preserving normal text content
 */
export function sanitizeString(value: string): string {
  if (!value) return '';
  
  return value
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Limit length to prevent memory issues
    .slice(0, 10000);
}

/**
 * Safely parses a number from string, handling Brazilian format
 */
export function safeParseNumber(value: string): number {
  if (!value) return 0;
  
  const sanitized = sanitizeString(value);
  
  // Handle Brazilian format (1.234,56) and standard format (1234.56)
  const cleaned = sanitized
    .replace(/[^\d.,\-]/g, '')
    .replace(/\.(?=.*\.)/g, '') // Remove thousands separators
    .replace(',', '.'); // Convert decimal comma to point
  
  const parsed = parseFloat(cleaned);
  
  // Validate it's a reasonable number
  if (isNaN(parsed) || !isFinite(parsed)) {
    return 0;
  }
  
  return parsed;
}

/**
 * Safely parses an integer from string
 */
export function safeParseInt(value: string): number {
  const num = safeParseNumber(value);
  return Math.floor(num);
}

/**
 * Validates file extension and size
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { valid: false, error: 'Por favor, selecione um arquivo .csv' };
  }
  
  // Max 10MB
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'Arquivo muito grande. Máximo: 10MB' };
  }
  
  return { valid: true };
}
