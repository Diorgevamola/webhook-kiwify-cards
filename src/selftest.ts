/**
 * Teste de fumaça da lógica crítica: verificação do webhook, parse do payload e
 * idempotência. Roda sem rede e sem SMTP.
 *   npx tsx src/selftest.ts   (ou: npm run build && node dist/selftest.js)
 */
import crypto from 'node:crypto';

const SECRET = 'secret-de-teste-123';
process.env.ABACATEPAY_WEBHOOK_SECRET ||= SECRET;
process.env.DATA_DIR ||= './.tmp-selftest';

const { verifySignature, parseCompra, emailValido } = await import('./abacatepay.js');
const { iniciarStore, foiEntregue, registrarEntrega } = await import('./store.js');

let passou = 0, falhou = 0;
function check(nome: string, cond: boolean, extra = '') {
  if (cond) { passou++; console.log(`  ok   ${nome}`); }
  else { falhou++; console.log(`  FALHA ${nome} ${extra}`); }
}

/** Mesma chave pública usada em abacatepay.ts — o teste assina como a AbacatePay. */
const HMAC_KEY_PUBLICA =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6i' +
  'Iga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0K' +
  'Z3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

const payloadAprovado = {
  id: 'log_abc123',
  event: 'checkout.completed',
  apiVersion: 2,
  devMode: false,
  data: {
    id: 'bill_0001',
    status: 'PAID',
    amount: 2700,
    items: [{ id: 'prod_QdUSrm302upUgDxSCEqjr6zh', quantity: 1, name: 'Cards de Segurança Familiar' }],
    customer: { metadata: { name: 'Maria Silva Souza', email: 'Maria@Exemplo.COM.BR', cellphone: '11999999999' } },
  },
};
const raw = Buffer.from(JSON.stringify(payloadAprovado), 'utf8');
const assinar = (corpo: Buffer) =>
  crypto.createHmac('sha256', HMAC_KEY_PUBLICA).update(corpo).digest('base64');
const urlComSecret = (s = SECRET) => new URL(`http://x/webhook/abacatepay?webhookSecret=${s}`);

console.log('\n== verificação do webhook ==');
check('aceita secret + HMAC corretos',
  verifySignature(raw, urlComSecret(), { 'x-webhook-signature': assinar(raw) }).valid);
check('aceita "secret" como nome alternativo na query',
  verifySignature(raw, new URL(`http://x/webhook?secret=${SECRET}`), { 'x-webhook-signature': assinar(raw) }).valid);
check('rejeita secret errado mesmo com HMAC válido',
  !verifySignature(raw, urlComSecret('errado'), { 'x-webhook-signature': assinar(raw) }).valid);
check('rejeita secret ausente',
  !verifySignature(raw, new URL('http://x/webhook'), { 'x-webhook-signature': assinar(raw) }).valid);
check('rejeita HMAC ausente',
  !verifySignature(raw, urlComSecret(), {}).valid);
check('rejeita HMAC errado',
  !verifySignature(raw, urlComSecret(), { 'x-webhook-signature': 'ZGVhZGJlZWY=' }).valid);
{
  // Assinatura válida do corpo original, mas corpo trocado: precisa cair.
  const adulterado = Buffer.from(JSON.stringify({ ...payloadAprovado, id: 'log_HACK' }), 'utf8');
  check('rejeita corpo adulterado com assinatura do original',
    !verifySignature(adulterado, urlComSecret(), { 'x-webhook-signature': assinar(raw) }).valid);
}
{
  const r = verifySignature(raw, urlComSecret('errado'), {});
  check('distingue as duas camadas no diagnóstico', !r.secretOk && !r.hmacOk, JSON.stringify(r));
}

console.log('\n== parse do payload ==');
{
  const c = parseCompra(payloadAprovado);
  check('extrai orderId da cobrança', c.orderId === 'bill_0001', c.orderId);
  check('extrai e normaliza e-mail', c.email === 'maria@exemplo.com.br', c.email);
  check('extrai primeiro nome', c.primeiroNome === 'Maria', c.primeiroNome);
  check('extrai id do produto', c.produtoId === 'prod_QdUSrm302upUgDxSCEqjr6zh', c.produtoId);
  check('marca como aprovada', c.aprovada);
}
{
  // customer sem o nível "metadata" — formato plausível alternativo
  const c = parseCompra({
    event: 'transparent.completed',
    data: {
      id: 'pix_1', status: 'PAID',
      customer: { name: 'João Pedro', email: 'joao@ex.com' },
      items: ['prod_X'],
    },
  });
  check('lê customer sem "metadata"', c.email === 'joao@ex.com' && c.aprovada, JSON.stringify(c));
  check('deriva primeiro nome', c.primeiroNome === 'João', c.primeiroNome);
  check('lê item como string', c.produtoId === 'prod_X', c.produtoId);
}
{
  const reembolso = parseCompra({ event: 'checkout.refunded', data: { id: 'b1', status: 'REFUNDED', customer: { email: 'a@b.com' } } });
  check('não aprova reembolso', !reembolso.aprovada);
  const pendente = parseCompra({ event: 'checkout.completed', data: { id: 'b2', status: 'PENDING', customer: { email: 'a@b.com' } } });
  check('não aprova cobrança pendente', !pendente.aprovada);
  const disputa = parseCompra({ event: 'checkout.disputed', data: { id: 'b3', status: 'PAID', customer: { email: 'a@b.com' } } });
  check('não aprova disputa', !disputa.aprovada);
}

console.log('\n== e-mail ==');
check('aceita e-mail válido', emailValido('a.b-c@dominio.com.br'));
check('rejeita e-mail sem @', !emailValido('semarroba.com'));
check('rejeita e-mail vazio', !emailValido(''));

console.log('\n== idempotência ==');
{
  iniciarStore();
  const id = `bill_${Date.now()}`;
  check('pedido novo ainda não entregue', !foiEntregue(id));
  registrarEntrega({ orderId: id, email: 'a@b.com', nome: 'A', produtoId: 'P', enviadoEm: new Date().toISOString() });
  check('pedido marcado após entrega', foiEntregue(id));
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou === 0 ? 0 : 1);
