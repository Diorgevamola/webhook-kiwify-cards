/**
 * Bootstrap resiliente.
 *
 * Se o servidor falhar ao iniciar, um container que simplesmente morre não diz
 * o porquê — e o painel nem sempre dá acesso ao log. Então, em caso de falha,
 * subimos um servidor mínimo que expõe o erro em /health, com status 500.
 * O deploy fica visivelmente quebrado, mas diagnosticável de fora.
 */
import http from 'node:http';

async function main() {
  try {
    await import('./server.js');
  } catch (err) {
    const e = err as Error;
    const detalhe = {
      ok: false,
      estado: 'FALHA_AO_INICIAR',
      erro: e?.message ?? String(err),
      stack: (e?.stack ?? '').split('\n').slice(0, 12),
      node: process.version,
      cwd: process.cwd(),
      envPresentes: Object.keys(process.env)
        .filter((k) => /^(PORT|PUBLIC_URL|DATA_DIR|ABACATEPAY_|SMTP_|MAIL_|DELIVERY_|SUPPORT_|NODE_ENV)/.test(k))
        .sort(),
    };

    console.error(JSON.stringify(detalhe));

    const porta = Number(process.env.PORT || 3000);
    http
      .createServer((_req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(detalhe, null, 2));
      })
      .listen(porta, '0.0.0.0', () => {
        console.error(`modo diagnóstico ouvindo na porta ${porta}`);
      });
  }
}

void main();
