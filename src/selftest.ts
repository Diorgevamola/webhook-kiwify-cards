/**
 * Teste de fumaça da lógica crítica: assinatura, parse do payload e
 * idempotência. Roda sem rede e sem SMTP.
 *   npx tsx src/selftest.ts   (ou: npm run build && node dist/selftest.js)
 */
import crypto from 'node:crypto';

process.env.KIWIFY_WEBHOOK_TOKEN ||= 'token-de-teste-123';
process.env.DATA_DIR ||= './.tmp-selftest';

const { verifySignature, parseCompra, emailValido } = await import('./kiwify.js');
const { iniciarStore, foiEntregue, registrarEntrega } = await import('./store.js');

let passou = 0, falhou = 0;
function check(nome: string, cond: boolean, extra = '') {
  if (cond) { passou++; console.log(`  ok   ${nome}`); }
  else { falhou++; console.log(`  FALHA ${nome} ${extra}`); }
}

const TOKEN = 'token-de-teste-123';
const payloadAprovado = {
  order_id: 'ORD-0001',
  order_status: 'paid',
  webhook_event_type: 'order_approved',
  Customer: { full_name: 'Maria Silva Souza', first_name: 'Maria', email: 'Maria@Exemplo.COM.BR' },
  Product: { product_id: 'PROD-99', product_name: '300 Cards de Segurança Familiar' },
};
const raw = Buffer.from(JSON.stringify(payloadAprovado), 'utf8');

console.log('\n== assinatura ==');
for (const alg of ['sha1', 'sha256'] as const) {
  const sig = crypto.createHmac(alg, TOKEN).update(raw).digest('hex');
  const r = verifySignature(raw, new URL(`http://x/webhook?signature=${sig}`), {});
  check(`aceita HMAC-${alg} correto`, r.valid && r.algorithm === alg, JSON.stringify(r));
}
check('rejeita assinatura errada',
  !verifySignature(raw, new URL('http://x/webhook?signature=deadbeef'), {}).valid);
check('rejeita assinatura ausente',
  !verifySignature(raw, new URL('http://x/webhook'), {}).valid);
{
  const sig = crypto.createHmac('sha1', TOKEN).update(raw).digest('hex');
  const adulterado = Buffer.from(JSON.stringify({ ...payloadAprovado, order_id: 'ORD-HACK' }), 'utf8');
  check('rejeita corpo adulterado com assinatura válida do original',
    !verifySignature(adulterado, new URL(`http://x/webhook?signature=${sig}`), {}).valid);
}
{
  const sig = crypto.createHmac('sha1', TOKEN).update(raw).digest('hex');
  check('aceita assinatura via header',
    verifySignature(raw, new URL('http://x/webhook'), { 'x-kiwify-signature': sig }).valid);
}

console.log('\n== parse do payload ==');
{
  const c = parseCompra(payloadAprovado);
  check('extrai orderId', c.orderId === 'ORD-0001', c.orderId);
  check('extrai e normaliza e-mail', c.email === 'maria@exemplo.com.br', c.email);
  check('extrai primeiro nome', c.primeiroNome === 'Maria', c.primeiroNome);
  check('marca como aprovada', c.aprovada);
}
{
  // variação de capitalização que a Kiwify já usou
  const c = parseCompra({
    order_id: 'ORD-2', order_status: 'paid',
    customer: { name: 'João Pedro', email: 'joao@ex.com' },
    product: { product_id: 'P2' },
  });
  check('lê "customer" minúsculo', c.email === 'joao@ex.com' && c.aprovada, JSON.stringify(c));
  check('deriva primeiro nome quando ausente', c.primeiroNome === 'João', c.primeiroNome);
}
{
  const recusada = parseCompra({ order_id: 'X', order_status: 'refused', webhook_event_type: 'order_rejected', Customer: { email: 'a@b.com' } });
  check('não aprova compra recusada', !recusada.aprovada);
  const reembolso = parseCompra({ order_id: 'Y', order_status: 'refunded', webhook_event_type: 'order_refunded', Customer: { email: 'a@b.com' } });
  check('não aprova reembolso', !reembolso.aprovada);
}

console.log('\n== e-mail ==');
check('aceita e-mail válido', emailValido('a.b-c@dominio.com.br'));
check('rejeita e-mail sem @', !emailValido('semarroba.com'));
check('rejeita e-mail vazio', !emailValido(''));

console.log('\n== idempotência ==');
{
  iniciarStore();
  const id = `ORD-${Date.now()}`;
  check('pedido novo ainda não entregue', !foiEntregue(id));
  registrarEntrega({ orderId: id, email: 'a@b.com', nome: 'A', produtoId: 'P', enviadoEm: new Date().toISOString() });
  check('pedido marcado após entrega', foiEntregue(id));
}

console.log(`\n${passou} passaram, ${falhou} falharam\n`);
process.exit(falhou === 0 ? 0 : 1);
