import crypto from 'node:crypto';
import { config } from './config.js';

/**
 * Assinatura do webhook.
 *
 * A Kiwify envia a assinatura na query string (`?signature=...`), calculada
 * sobre o corpo BRUTO da requisição usando o token do webhook como chave.
 * A documentação pública não fixa o algoritmo, então aceitamos SHA-1 e SHA-256
 * e registramos qual bateu — assim o formato real aparece no primeiro webhook
 * verdadeiro, sem precisar adivinhar.
 *
 * O corpo precisa ser o buffer original: reserializar o JSON muda os bytes
 * e quebra a assinatura.
 */

export type SignatureCheck = {
  valid: boolean;
  algorithm: string | null;
  received: string | null;
  reason?: string;
};

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function verifySignature(rawBody: Buffer, url: URL, headers: Record<string, string | string[] | undefined>): SignatureCheck {
  const token = config.kiwify.webhookToken;

  const received =
    url.searchParams.get('signature') ||
    (headers['x-kiwify-signature'] as string | undefined) ||
    (headers['x-signature'] as string | undefined) ||
    null;

  if (!token) return { valid: false, algorithm: null, received, reason: 'token do webhook não configurado' };
  if (!received) return { valid: false, algorithm: null, received: null, reason: 'assinatura ausente na requisição' };

  for (const algorithm of ['sha1', 'sha256'] as const) {
    const expected = crypto.createHmac(algorithm, token).update(rawBody).digest('hex');
    if (timingSafeEqualStr(expected, received.toLowerCase())) {
      return { valid: true, algorithm, received };
    }
  }

  return { valid: false, algorithm: null, received, reason: 'assinatura não confere' };
}

/** Dados que realmente importam para entregar o produto. */
export type Compra = {
  orderId: string;
  status: string;
  evento: string;
  nome: string;
  primeiroNome: string;
  email: string;
  produtoId: string;
  produtoNome: string;
  aprovada: boolean;
};

function pick(obj: any, ...caminhos: string[]): string {
  for (const caminho of caminhos) {
    const valor = caminho.split('.').reduce((acc: any, chave) => (acc == null ? acc : acc[chave]), obj);
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
  }
  return '';
}

/**
 * A Kiwify já mudou a capitalização de alguns campos entre versões
 * (`Customer` vs `customer`), então lemos de forma tolerante.
 */
export function parseCompra(payload: any): Compra {
  const status = pick(payload, 'order_status', 'status').toLowerCase();
  const evento = pick(payload, 'webhook_event_type', 'event', 'event_type').toLowerCase();

  const nome = pick(payload, 'Customer.full_name', 'customer.full_name', 'Customer.name', 'customer.name');
  const email = pick(payload, 'Customer.email', 'customer.email', 'buyer.email', 'email').toLowerCase();

  const primeiroNome =
    pick(payload, 'Customer.first_name', 'customer.first_name') || nome.split(/\s+/)[0] || '';

  const aprovada =
    status === 'paid' ||
    status === 'approved' ||
    evento === 'order_approved' ||
    evento === 'compra_aprovada';

  return {
    orderId: pick(payload, 'order_id', 'id', 'order_ref') || 'sem-id',
    status,
    evento,
    nome,
    primeiroNome,
    email,
    produtoId: pick(payload, 'Product.product_id', 'product.product_id', 'product_id'),
    produtoNome: pick(payload, 'Product.product_name', 'product.product_name', 'product_name'),
    aprovada,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function emailValido(email: string): boolean {
  return EMAIL_RE.test(email);
}
