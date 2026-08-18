import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config.js';
import { montarEmail } from './template.js';
import type { Compra } from './kiwify.js';

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

export async function enviarEntrega(compra: Compra): Promise<{ messageId: string }> {
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

  return { messageId: info.messageId };
}
