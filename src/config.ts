/**
 * Configuração central. Tudo vem de variável de ambiente — nada de valor
 * fixo no código. Falha cedo e alto quando falta algo obrigatório.
 */

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

function opt(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === '') return fallback;
  return v === '1' || v === 'true' || v === 'sim';
}

export const config = {
  port: Number(opt('PORT', '3000')),

  /**
   * URL pública do serviço. Hoje é o subdomínio do EasyPanel; quando o domínio
   * próprio existir, basta trocar esta variável — nada mais no código muda.
   */
  publicUrl: opt('PUBLIC_URL', '').replace(/\/+$/, ''),

  abacate: {
    /** Secret do webhook, definido por você no painel da AbacatePay. */
    webhookSecret: opt('ABACATEPAY_WEBHOOK_SECRET'),
    /**
     * Quando true (padrão), rejeita requisição que não passe na verificação.
     * Deixe false SÓ no primeiro teste, para ver nos logs o formato que a
     * AbacatePay envia — o serviço registra o que chegou. Volte para true.
     */
    strictSignature: bool('ABACATEPAY_STRICT_SIGNATURE', true),
    /** Se preenchido, só processa webhooks deste produto (prod_...). */
    productId: opt('ABACATEPAY_PRODUCT_ID'),
  },

  smtp: {
    host: opt('SMTP_HOST'),
    port: Number(opt('SMTP_PORT', '587')),
    secure: bool('SMTP_SECURE', false), // true para porta 465
    user: opt('SMTP_USER'),
    pass: opt('SMTP_PASS'),
    fromName: opt('MAIL_FROM_NAME', '300 Cards de Segurança Familiar'),
    fromEmail: opt('MAIL_FROM_EMAIL'),
    replyTo: opt('MAIL_REPLY_TO'),
    /** Cópia oculta para você acompanhar as entregas. Opcional. */
    bcc: opt('MAIL_BCC'),
  },

  /** Link de entrega do produto (pasta do Google Drive). */
  delivery: {
    url: opt('DELIVERY_URL'),
    bonusUrl: opt('DELIVERY_BONUS_URL'),
    supportWhatsapp: opt('SUPPORT_WHATSAPP'),
    supportEmail: opt('SUPPORT_EMAIL'),
  },

  /** Onde guardar o registro de entregas (para idempotência). */
  dataDir: opt('DATA_DIR', '/data'),
};

/** Valida o que é indispensável para o serviço cumprir sua função. */
export function validateConfig(): string[] {
  const problemas: string[] = [];
  if (!config.smtp.host) problemas.push('SMTP_HOST não configurado — nenhum e-mail será enviado');
  if (!config.smtp.user) problemas.push('SMTP_USER não configurado');
  if (!config.smtp.pass) problemas.push('SMTP_PASS não configurado');
  if (!config.smtp.fromEmail) problemas.push('MAIL_FROM_EMAIL não configurado');
  if (!config.delivery.url) problemas.push('DELIVERY_URL não configurado — o e-mail sairia sem o link do produto');
  if (!config.abacate.webhookSecret) {
    problemas.push('ABACATEPAY_WEBHOOK_SECRET não configurado — impossível validar o webhook');
  }
  return problemas;
}

export { req };
