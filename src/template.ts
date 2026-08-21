import { config } from './config.js';
import type { Compra } from './abacatepay.js';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Passos do "como começar", vindos de `MAIL_STEPS` no formato
 * `titulo::corpo` separados por `|`. Entrada malformada é descartada em vez de
 * quebrar o envio — e-mail sem a seção é melhor que compra sem e-mail.
 */
function lerPassos(bruto: string): Array<{ titulo: string; corpo: string }> {
  return bruto
    .split('|')
    .map((p) => p.split('::'))
    .filter((partes) => partes[0]?.trim())
    .map(([titulo, corpo]) => ({ titulo: (titulo ?? '').trim(), corpo: (corpo ?? '').trim() }));
}

/**
 * E-mail de entrega. Mantém a identidade visual do produto e resolve, já na
 * primeira leitura, as três dúvidas que geram suporte: onde baixar, como
 * imprimir e por onde começar.
 *
 * Todo texto específico do produto vem de `config.product`, cujos defaults são
 * os dos 300 Cards. Assim o mesmo serviço entrega produtos diferentes em
 * instâncias diferentes, sem fork do código.
 */
export function montarEmail(compra: Compra) {
  const nome = compra.primeiroNome ? esc(compra.primeiroNome) : 'Olá';
  const link = config.delivery.url;
  const bonus = config.delivery.bonusUrl;
  const suporteEmail = config.delivery.supportEmail || config.smtp.replyTo || config.smtp.fromEmail;
  const whats = config.delivery.supportWhatsapp;
  const p = config.product;
  const passos = lerPassos(p.steps);
  const passosTexto = lerPassos(p.stepsText || p.steps);

  const assunto = p.subject;

  const texto = [
    `${compra.primeiroNome || 'Olá'}, seu acesso está liberado.`,
    '',
    p.textLinkLabel,
    link,
    bonus ? `\n${p.bonusTitle} (complemento):\n${bonus}` : '',
    '',
    passosTexto.length ? 'COMO COMEÇAR' : '',
    ...passosTexto.map((s) => `${s.titulo} ${s.corpo}`.trim()),
    '',
    p.tipBodyText || p.tipBody ? (p.tipTitleText || p.tipTitle.toUpperCase()) : '',
    p.tipBodyText || p.tipBody,
    '',
    'O acesso é vitalício: baixe e imprima quantas vezes quiser.',
    '',
    suporteEmail ? `Dúvidas? Responda este e-mail ou escreva para ${suporteEmail}.` : '',
    whats ? `WhatsApp: ${whats}` : '',
    '',
    [p.name, p.subtitle].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:#FDFAF3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2A2320;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF3;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #E7DFD2;border-radius:16px;overflow:hidden;">

  <tr><td style="background:${esc(p.colorDark)};padding:26px 30px;text-align:center;">
    <div style="font-size:30px;line-height:1;margin-bottom:8px;">${esc(p.emoji)}</div>
    <div style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-.2px;">${esc(p.name)}</div>
    ${p.subtitle ? `<div style="color:#A9BDD2;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-top:5px;font-weight:700;">${esc(p.subtitle)}</div>` : ''}
  </td></tr>

  <tr><td style="padding:30px 30px 8px;">
    <p style="margin:0 0 14px;font-size:19px;font-weight:800;color:${esc(p.colorDark)};">${nome}, seu acesso está liberado.</p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#5A6B7D;">
      ${esc(p.intro)}
    </p>
  </td></tr>

  <tr><td style="padding:22px 30px 8px;" align="center">
    <a href="${esc(link)}" style="display:inline-block;background:${esc(p.colorAccent)};color:#fff;text-decoration:none;font-size:16px;font-weight:800;padding:16px 34px;border-radius:12px;">
      ${esc(p.ctaLabel)}
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
        <div style="font-size:15px;font-weight:800;color:${esc(p.colorDark)};margin-bottom:4px;">${esc(p.bonusTitle)}</div>
        <p style="margin:0 0 10px;font-size:13px;color:#6B5A38;line-height:1.55;">
          ${esc(p.bonusText)}
        </p>
        <a href="${esc(bonus)}" style="color:#15803D;font-weight:800;font-size:13px;text-decoration:none;">Baixar o complemento →</a>
      </td></tr>
    </table>
  </td></tr>` : ''}

  ${passos.length ? `<tr><td style="padding:26px 30px 0;">
    <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${esc(p.colorAccent)};margin-bottom:12px;">Como começar</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${passos
        .map(
          (s, i) =>
            `<tr><td style="${i < passos.length - 1 ? 'padding-bottom:12px;' : ''}font-size:14px;line-height:1.55;color:#5A6B7D;">
        <b style="color:${esc(p.colorDark)};">${esc(s.titulo)}</b>${s.corpo ? ` ${esc(s.corpo)}` : ''}
      </td></tr>`
        )
        .join('\n      ')}
    </table>
  </td></tr>` : ''}

  ${p.tipBody ? `<tr><td style="padding:22px 30px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1FAF4;border-left:3px solid ${esc(p.colorAccent)};border-radius:0 10px 10px 0;">
      <tr><td style="padding:14px 16px;font-size:13px;line-height:1.55;color:#3E5A49;">
        <b style="color:#15803D;">${esc(p.tipTitle)}</b><br>
        ${esc(p.tipBody)}
      </td></tr>
    </table>
  </td></tr>` : ''}

  <tr><td style="padding:24px 30px 30px;">
    <p style="margin:0 0 6px;font-size:13px;color:#5A6B7D;line-height:1.6;">
      Seu acesso é <b style="color:${esc(p.colorDark)};">vitalício</b>: pode baixar e imprimir quantas vezes quiser.
    </p>
    ${suporteEmail ? `<p style="margin:0;font-size:13px;color:#5A6B7D;line-height:1.6;">
      Qualquer dúvida, é só responder este e-mail${whats ? ` ou chamar no WhatsApp <b style="color:${esc(p.colorDark)};">${esc(whats)}</b>` : ''}.
    </p>` : ''}
  </td></tr>

  <tr><td style="background:${esc(p.colorDark)};padding:18px 30px;text-align:center;">
    <p style="margin:0;color:#A9BDD2;font-size:11px;line-height:1.6;">
      ${esc([p.name, p.subtitle].filter(Boolean).join(' · '))}${p.footerNote ? `<br>
      ${esc(p.footerNote)}` : ''}
    </p>
  </td></tr>

</table>
<p style="max-width:600px;margin:14px auto 0;font-size:11px;color:#98A5B4;text-align:center;line-height:1.5;">
  Você recebeu este e-mail porque comprou o produto${compra.orderId !== 'sem-id' ? ` (pedido ${esc(compra.orderId)})` : ''}.
</p>
</td></tr></table></body></html>`;

  return { assunto, html, texto };
}
