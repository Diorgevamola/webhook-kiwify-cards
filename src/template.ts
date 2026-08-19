import { config } from './config.js';
import type { Compra } from './abacatepay.js';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * E-mail de entrega. Mantém a identidade visual do produto e resolve, já na
 * primeira leitura, as três dúvidas que geram suporte: onde baixar, como
 * imprimir e por onde começar.
 */
export function montarEmail(compra: Compra) {
  const nome = compra.primeiroNome ? esc(compra.primeiroNome) : 'Olá';
  const link = config.delivery.url;
  const bonus = config.delivery.bonusUrl;
  const suporteEmail = config.delivery.supportEmail || config.smtp.replyTo || config.smtp.fromEmail;
  const whats = config.delivery.supportWhatsapp;

  const assunto = 'Seus 300 Cards de Segurança Familiar estão prontos 🛡️';

  const texto = [
    `${nome}, seu acesso está liberado.`,
    '',
    'Baixe aqui o kit completo:',
    link,
    bonus ? `\nPlano Impresso Pronto (complemento):\n${bonus}` : '',
    '',
    'COMO COMEÇAR',
    '1. Baixe o PDF e imprima a primeira folha (cartas 001 a 009).',
    '2. Recorte pelas marcas — são 9 cartas por folha.',
    '3. Resolva essas 9 com a família. É o diagnóstico de risco da sua casa.',
    '',
    'DICA DE IMPRESSÃO',
    'Imprima em escala 100%. Se marcar "ajustar à página", as marcas de corte',
    'param de bater. Papel de 180 g deixa a carta firme, mas sulfite comum funciona.',
    '',
    'O acesso é vitalício: baixe e imprima quantas vezes quiser.',
    '',
    suporteEmail ? `Dúvidas? Responda este e-mail ou escreva para ${suporteEmail}.` : '',
    whats ? `WhatsApp: ${whats}` : '',
    '',
    '300 Cards de Segurança Familiar · Edição Brasil',
  ].filter(Boolean).join('\n');

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:#FDFAF3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A2320;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF3;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #E7DFD2;border-radius:16px;overflow:hidden;">

  <tr><td style="background:#0E2F50;padding:26px 30px;text-align:center;">
    <div style="font-size:30px;line-height:1;margin-bottom:8px;">🛡️</div>
    <div style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-.2px;">300 Cards de Segurança Familiar</div>
    <div style="color:#A9BDD2;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-top:5px;font-weight:700;">Edição Brasil</div>
  </td></tr>

  <tr><td style="padding:30px 30px 8px;">
    <p style="margin:0 0 14px;font-size:19px;font-weight:800;color:#0E2F50;">${nome}, seu acesso está liberado.</p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#5A6B7D;">
      Obrigado pela compra. Está tudo pronto para você imprimir e começar a montar
      o plano de segurança da sua família.
    </p>
  </td></tr>

  <tr><td style="padding:22px 30px 8px;" align="center">
    <a href="${esc(link)}" style="display:inline-block;background:#16A34A;color:#fff;text-decoration:none;font-size:16px;font-weight:800;padding:16px 34px;border-radius:12px;">
      BAIXAR MEUS 300 CARDS
    </a>
    <p style="margin:12px 0 0;font-size:12px;color:#8A97A6;">
      Se o botão não abrir, copie e cole no navegador:<br>
      <span style="color:#5A6B7D;word-break:break-all;">${esc(link)}</span>
    </p>
  </td></tr>

  ${bonus ? `<tr><td style="padding:14px 30px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8E6;border:1px solid #F2E2BC;border-radius:12px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8A6208;margin-bottom:5px;">Complemento incluso</div>
        <div style="font-size:15px;font-weight:800;color:#0E2F50;margin-bottom:4px;">Plano Impresso Pronto</div>
        <p style="margin:0 0 10px;font-size:13px;color:#6B5A38;line-height:1.55;">
          Índice das 300 cartas, o Plano da Família para preencher e o guia de impressão.
        </p>
        <a href="${esc(bonus)}" style="color:#15803D;font-weight:800;font-size:13px;text-decoration:none;">Baixar o complemento →</a>
      </td></tr>
    </table>
  </td></tr>` : ''}

  <tr><td style="padding:26px 30px 0;">
    <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#16A34A;margin-bottom:12px;">Como começar</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding-bottom:12px;font-size:14px;line-height:1.55;color:#5A6B7D;">
        <b style="color:#0E2F50;">1. Imprima a primeira folha.</b> São as cartas 001 a 009.
      </td></tr>
      <tr><td style="padding-bottom:12px;font-size:14px;line-height:1.55;color:#5A6B7D;">
        <b style="color:#0E2F50;">2. Recorte pelas marcas.</b> Nove cartas por folha.
      </td></tr>
      <tr><td style="font-size:14px;line-height:1.55;color:#5A6B7D;">
        <b style="color:#0E2F50;">3. Resolva essas nove com a família.</b> É o diagnóstico de risco da sua casa — em uns 20 minutos vocês já têm as primeiras decisões no papel.
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 30px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1FAF4;border-left:3px solid #16A34A;border-radius:0 10px 10px 0;">
      <tr><td style="padding:14px 16px;font-size:13px;line-height:1.55;color:#3E5A49;">
        <b style="color:#15803D;">Antes de imprimir</b><br>
        Use escala 100%. Marcar “ajustar à página” encolhe tudo e as marcas de corte
        param de bater. Papel de 180 g deixa a carta firme — sulfite comum também funciona.
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 30px 30px;">
    <p style="margin:0 0 6px;font-size:13px;color:#5A6B7D;line-height:1.6;">
      Seu acesso é <b style="color:#0E2F50;">vitalício</b>: pode baixar e imprimir quantas vezes quiser.
    </p>
    ${suporteEmail ? `<p style="margin:0;font-size:13px;color:#5A6B7D;line-height:1.6;">
      Qualquer dúvida, é só responder este e-mail${whats ? ` ou chamar no WhatsApp <b style="color:#0E2F50;">${esc(whats)}</b>` : ''}.
    </p>` : ''}
  </td></tr>

  <tr><td style="background:#0E2F50;padding:18px 30px;text-align:center;">
    <p style="margin:0;color:#A9BDD2;font-size:11px;line-height:1.6;">
      300 Cards de Segurança Familiar · Edição Brasil<br>
      Material educativo. Em emergência real, acione SAMU 192, Bombeiros 193 ou Polícia 190.
    </p>
  </td></tr>

</table>
<p style="max-width:600px;margin:14px auto 0;font-size:11px;color:#98A5B4;text-align:center;line-height:1.5;">
  Você recebeu este e-mail porque comprou o produto${compra.orderId !== 'sem-id' ? ` (pedido ${esc(compra.orderId)})` : ''}.
</p>
</td></tr></table></body></html>`;

  return { assunto, html, texto };
}
