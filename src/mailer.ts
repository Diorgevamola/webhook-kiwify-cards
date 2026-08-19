import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config.js';
import { montarEmail } from './template.js';
import type { Compra } from './abacatepay.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    pool: true,
    maxConnections: 3,
  });
  return transporter;
}

/** Confere as credenciais SMTP sem enviar nada. */
export async function verificarSmtp(): Promise<{ ok: boolean; erro?: string }> {
  if (!config.smtp.host) return { ok: false, erro: 'SMTP_HOST não configurado' };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: (err as Error).message };
  }
}

export async function enviarEntrega(
  compra: Compra
): Promise<{ messageId: string; aceitos: string[]; resposta: string }> {
  const { assunto, html, texto } = montarEmail(compra);

  const info = await getTransporter().sendMail({
    from: { name: config.smtp.fromName, address: config.smtp.fromEmail },
    to: compra.nome ? `"${compra.nome.replace(/"/g, '')}" <${compra.email}>` : compra.email,
    replyTo: config.smtp.replyTo || undefined,
    bcc: config.smtp.bcc || undefined,
    subject: assunto,
    text: texto,
    html,
  });

  /**
   * `sendMail` resolver não significa que o e-mail saiu: o servidor pode
   * aceitar a conexão e recusar o destinatário. Nesse caso `rejected` vem
   * preenchido e `accepted` vazio — e sem esta checagem a entrega seria
   * marcada como concluída com o comprador sem receber nada.
   */
  const aceitos = (info.accepted ?? []).map(String);
  const rejeitados = (info.rejected ?? []).map(String);
  if (!aceitos.length) {
    throw new Error(
      `servidor SMTP nao aceitou nenhum destinatario (rejeitados: ${rejeitados.join(', ') || 'nenhum listado'}) — resposta: ${info.response ?? 'sem resposta'}`
    );
  }

  return { messageId: info.messageId, aceitos, resposta: String(info.response ?? '') };
}
