import http from 'node:http';
import { config, validateConfig } from './config.js';
import { verifySignature, parseCompra, emailValido } from './kiwify.js';
import { enviarEntrega, verificarSmtp } from './mailer.js';
import { iniciarStore, foiEntregue, registrarEntrega, totalEntregas } from './store.js';

const MAX_BODY = 1_000_000; // 1 MB: webhook legítimo é muito menor

function log(nivel: 'info' | 'warn' | 'error', msg: string, dados: Record<string, unknown> = {}) {
  console[nivel === 'error' ? 'error' : 'log'](
    JSON.stringify({ ts: new Date().toISOString(), nivel, msg, ...dados })
  );
}

function json(res: http.ServerResponse, status: number, corpo: unknown) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(texto);
}

function lerCorpo(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (parte: Buffer) => {
      total += parte.length;
      if (total > MAX_BODY) {
        reject(new Error('corpo excede o limite'));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

/**
 * Processa a compra depois de já ter respondido 200 à Kiwify.
 * Webhook que demora vira retry; a entrega em si não precisa segurar a resposta.
 */
async function processar(rawBody: Buffer) {
  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    log('error', 'payload não é JSON válido');
    return;
  }

  const compra = parseCompra(payload);

  if (!compra.aprovada) {
    log('info', 'evento ignorado (não é compra aprovada)', {
      orderId: compra.orderId, status: compra.status, evento: compra.evento,
    });
    return;
  }

  if (config.kiwify.productId && compra.produtoId && compra.produtoId !== config.kiwify.productId) {
    log('info', 'compra de outro produto, ignorada', {
      orderId: compra.orderId, produtoId: compra.produtoId,
    });
    return;
  }

  if (!emailValido(compra.email)) {
    log('error', 'compra aprovada sem e-mail válido — entrega manual necessária', {
      orderId: compra.orderId, email: compra.email, nome: compra.nome,
    });
    return;
  }

  if (foiEntregue(compra.orderId)) {
    log('info', 'entrega já feita, ignorando reenvio', { orderId: compra.orderId });
    return;
  }

  try {
    const { messageId } = await enviarEntrega(compra);
    registrarEntrega({
      orderId: compra.orderId,
      email: compra.email,
      nome: compra.nome,
      produtoId: compra.produtoId,
      enviadoEm: new Date().toISOString(),
      messageId,
    });
    log('info', 'produto entregue por e-mail', {
      orderId: compra.orderId, email: compra.email, messageId, totalEntregas: totalEntregas(),
    });
  } catch (err) {
    // Não registra como entregue: assim um retry da Kiwify tenta de novo.
    log('error', 'FALHA AO ENVIAR — comprador ficou sem o produto', {
      orderId: compra.orderId, email: compra.email, erro: (err as Error).message,
    });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const rota = url.pathname.replace(/\/+$/, '') || '/';

  if (rota === '/health') {
    return json(res, 200, { ok: true, entregas: totalEntregas() });
  }

  if (rota === '/' && req.method === 'GET') {
    return json(res, 200, {
      servico: 'webhook-kiwify · 300 Cards de Segurança Familiar',
      webhook: `${config.publicUrl || ''}/webhook/kiwify`,
    });
  }

  if (rota === '/webhook/kiwify') {
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'POST' });
      return res.end();
    }

    let rawBody: Buffer;
    try {
      rawBody = await lerCorpo(req);
    } catch (err) {
      log('warn', 'corpo rejeitado', { erro: (err as Error).message });
      return json(res, 413, { erro: 'corpo grande demais' });
    }

    const check = verifySignature(rawBody, url, req.headers);

    if (!check.valid) {
      // Loga o formato recebido para descobrir o esquema real da Kiwify
      // sem precisar aceitar requisição não autenticada.
      log('warn', 'assinatura inválida', {
        motivo: check.reason,
        assinaturaRecebida: check.received ? `${check.received.slice(0, 12)}…(${check.received.length} chars)` : null,
        queryKeys: [...url.searchParams.keys()],
        headersKiwify: Object.keys(req.headers).filter((h) => h.includes('kiwify') || h.includes('signature')),
        strict: config.kiwify.strictSignature,
      });

      if (config.kiwify.strictSignature) {
        return json(res, 401, { erro: 'assinatura inválida' });
      }
    } else {
      log('info', 'assinatura conferida', { algoritmo: check.algorithm });
    }

    // Responde já: a Kiwify não deve esperar o SMTP.
    json(res, 200, { recebido: true });
    void processar(rawBody);
    return;
  }

  return json(res, 404, { erro: 'rota não encontrada' });
});

const problemas = validateConfig();
const store = iniciarStore();

server.listen(config.port, () => {
  log('info', 'servidor no ar', {
    porta: config.port,
    urlPublica: config.publicUrl || '(não configurada)',
    webhook: `${config.publicUrl || ''}/webhook/kiwify`,
    assinaturaEstrita: config.kiwify.strictSignature,
    persistencia: store.persistente,
    entregasCarregadas: store.carregadas,
  });

  if (store.aviso) log('warn', store.aviso);
  for (const p of problemas) log('warn', `configuração incompleta: ${p}`);

  void verificarSmtp().then((r) =>
    r.ok
      ? log('info', 'SMTP conectado com sucesso')
      : log('error', 'SMTP indisponível — compras aprovadas NÃO serão entregues', { erro: r.erro })
  );
});

for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    log('info', 'encerrando', { sinal });
    server.close(() => process.exit(0));
  });
}
