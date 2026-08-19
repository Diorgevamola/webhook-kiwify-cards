import crypto from 'node:crypto';
import { config } from './config.js';

/**
 * Verificação do webhook da AbacatePay. Duas camadas, ambas obrigatórias
 * quando `ABACATEPAY_STRICT_SIGNATURE` está ligado:
 *
 * 1. `webhookSecret` na query string — o valor que você define ao cadastrar o
 *    webhook no painel. Esta é a barreira REAL: só quem tem o secret consegue
 *    chamar a rota.
 * 2. HMAC-SHA256 do corpo bruto, em base64, no header `X-Webhook-Signature`.
 *
 * Sobre a camada 2: a chave HMAC da AbacatePay é PÚBLICA — está impressa na
 * documentação, igual para todos os integradores. Ela garante integridade em
 * trânsito (o corpo não foi alterado no caminho), mas NÃO autenticidade:
 * qualquer um consegue calculá-la. Por isso o secret da URL é indispensável;
 * a assinatura sozinha não protegeria nada.
 *
 * O corpo precisa ser o buffer original — reserializar o JSON muda os bytes e
 * quebra a assinatura.
 */

/** Chave HMAC pública da AbacatePay (docs.abacatepay.com/pages/webhooks). */
const HMAC_KEY_PUBLICA =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6i' +
  'Iga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0K' +
  'Z3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

export type SignatureCheck = {
  valid: boolean;
  /** Camada 1: o secret da query conferiu. */
  secretOk: boolean;
  /** Camada 2: o HMAC do corpo conferiu. */
  hmacOk: boolean;
  received: string | null;
  reason?: string;
};

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function verifySignature(
  rawBody: Buffer,
  url: URL,
  headers: Record<string, string | string[] | undefined>
): SignatureCheck {
  const secretEsperado = config.abacate.webhookSecret;

  const secretRecebido =
    url.searchParams.get('webhookSecret') || url.searchParams.get('secret') || null;

  const assinatura =
    (headers['x-webhook-signature'] as string | undefined) ||
    (headers['x-signature'] as string | undefined) ||
    null;

  if (!secretEsperado) {
    return {
      valid: false, secretOk: false, hmacOk: false, received: assinatura,
      reason: 'ABACATEPAY_WEBHOOK_SECRET não configurado',
    };
  }

  const secretOk = !!secretRecebido && timingSafeEqualStr(secretRecebido, secretEsperado);

  const esperado = crypto
    .createHmac('sha256', HMAC_KEY_PUBLICA)
    .update(rawBody)
    .digest('base64');
  const hmacOk = !!assinatura && timingSafeEqualStr(assinatura, esperado);

  let reason: string | undefined;
  if (!secretOk) reason = secretRecebido ? 'secret da query não confere' : 'secret ausente na query';
  else if (!hmacOk) reason = assinatura ? 'assinatura HMAC não confere' : 'header X-Webhook-Signature ausente';

  return { valid: secretOk && hmacOk, secretOk, hmacOk, received: assinatura, reason };
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

/** Primeiro id de produto encontrado na lista de items do checkout. */
function primeiroItemId(data: any): string {
  const items = data?.items ?? data?.billing?.items ?? data?.products;
  if (Array.isArray(items) && items.length) {
    const it = items[0];
    if (typeof it === 'string') return it;
    return pick(it, 'id', 'productId', 'product.id', 'externalId');
  }
  return '';
}

function primeiroItemNome(data: any): string {
  const items = data?.items ?? data?.billing?.items ?? data?.products;
  if (Array.isArray(items) && items.length && typeof items[0] === 'object') {
    return pick(items[0], 'name', 'productName', 'product.name');
  }
  return '';
}

/**
 * Eventos que significam "pagou, pode entregar":
 *   - `checkout.completed`  — pagamento do link/checkout concluído
 *   - `transparent.completed` — checkout transparente (PIX QR Code) concluído
 * Reembolso e disputa NÃO entregam (e hoje não revogam nada — a entrega é um
 * link de Drive; revogar exigiria mudar a forma de entrega).
 *
 * O formato exato de `data` não está fixado na documentação pública, então a
 * leitura é tolerante: procura os campos em vários caminhos plausíveis. O que
 * chegou de verdade aparece no log do primeiro webhook real.
 */
export function parseCompra(payload: any): Compra {
  const evento = pick(payload, 'event', 'type').toLowerCase();
  const data = payload?.data ?? payload;

  const status = pick(data, 'status', 'billing.status', 'payment.status').toUpperCase();

  const nome = pick(
    data,
    'customer.metadata.name', 'customer.name',
    'billing.customer.metadata.name', 'billing.customer.name',
    'metadata.name'
  );

  const email = pick(
    data,
    'customer.metadata.email', 'customer.email',
    'billing.customer.metadata.email', 'billing.customer.email',
    'metadata.email', 'payer.email'
  ).toLowerCase();

  const aprovada =
    (evento === 'checkout.completed' || evento === 'transparent.completed') &&
    (status === '' || status === 'PAID' || status === 'COMPLETED');

  return {
    orderId:
      pick(data, 'id', 'billing.id', 'externalId', 'billing.externalId') ||
      pick(payload, 'id') ||
      'sem-id',
    status,
    evento,
    nome,
    primeiroNome: nome.split(/\s+/)[0] || '',
    email,
    produtoId: primeiroItemId(data),
    produtoNome: primeiroItemNome(data),
    aprovada,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function emailValido(email: string): boolean {
  return EMAIL_RE.test(email);
}
