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

/**
 * Como `opt`, mas distingue "variável ausente" de "variável definida e vazia".
 * Sem isso não há como DESLIGAR um texto que tem default: `opt` cairia no
 * fallback e o rodapé de um produto vazaria no e-mail de outro.
 */
function optText(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined ? fallback : v.trim();
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
    /**
     * Nome anunciado no EHLO. Default: o domínio do remetente, que sempre
     * resolve e combina com o envelope. Só precisa ser sobrescrito se o
     * servidor de saída exigir um hostname específico.
     */
    heloName: opt('SMTP_HELO_NAME') || opt('MAIL_FROM_EMAIL').split('@')[1] || 'localhost',
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

  /**
   * Identidade do produto no e-mail de entrega. Os defaults são os dos 300
   * Cards de Segurança Familiar, para que a instância que já roda continue
   * idêntica sem precisar de nenhuma variável nova. Uma segunda instância do
   * mesmo serviço entrega outro produto só trocando estas variáveis.
   */
  product: {
    name: opt('PRODUCT_NAME', '300 Cards de Segurança Familiar'),
    subtitle: optText('PRODUCT_SUBTITLE', 'Edição Brasil'),
    emoji: opt('PRODUCT_EMOJI', '🛡️'),
    /** Cor do cabeçalho e do rodapé do e-mail. */
    colorDark: opt('PRODUCT_COLOR_DARK', '#0E2F50'),
    /** Cor do botão e dos destaques. */
    colorAccent: opt('PRODUCT_COLOR_ACCENT', '#16A34A'),
    subject: opt('MAIL_SUBJECT', 'Seus 300 Cards de Segurança Familiar estão prontos 🛡️'),
    ctaLabel: opt('CTA_LABEL', 'BAIXAR MEUS 300 CARDS'),
    /** Frase que antecede o link na versão em texto puro do e-mail. */
    textLinkLabel: opt('MAIL_TEXT_LINK_LABEL', 'Baixe aqui o kit completo:'),
    intro: optText(
      'MAIL_INTRO',
      'Obrigado pela compra. Está tudo pronto para você imprimir e começar a montar o plano de segurança da sua família.'
    ),
    /**
     * Passos do "como começar", no formato `titulo::corpo` separados por `|`.
     * Vazio omite a seção inteira.
     */
    steps: optText(
      'MAIL_STEPS',
      '1. Imprima a primeira folha.::São as cartas 001 a 009.' +
        '|2. Recorte pelas marcas.::Nove cartas por folha.' +
        '|3. Resolva essas nove com a família.::É o diagnóstico de risco da sua casa — em uns 20 minutos vocês já têm as primeiras decisões no papel.'
    ),
    /**
     * Passos na versao em texto puro. Sao redigidos de forma diferente do HTML
     * de proposito: sem negrito, a frase precisa se sustentar sozinha.
     * Mesmo formato de `steps`; vazio reaproveita `steps`.
     */
    stepsText: optText(
      'MAIL_STEPS_TEXT',
      '1. Baixe o PDF e imprima a primeira folha (cartas 001 a 009).' +
        '|2. Recorte pelas marcas — são 9 cartas por folha.' +
        '|3. Resolva essas 9 com a família. É o diagnóstico de risco da sua casa.'
    ),
    tipTitle: opt('MAIL_TIP_TITLE', 'Antes de imprimir'),
    tipBody: optText(
      'MAIL_TIP_BODY',
      'Use escala 100%. Marcar “ajustar à página” encolhe tudo e as marcas de corte param de bater. Papel de 180 g deixa a carta firme — sulfite comum também funciona.'
    ),
    /**
     * Titulo e corpo da dica na versao em texto puro — tambem redigidos de
     * forma propria. Vazio reaproveita `tipTitle` / `tipBody`.
     */
    tipTitleText: optText('MAIL_TIP_TITLE_TEXT', 'DICA DE IMPRESSÃO'),
    tipBodyText: optText(
      'MAIL_TIP_BODY_TEXT',
      'Imprima em escala 100%. Se marcar "ajustar à página", as marcas de corte\n' +
        'param de bater. Papel de 180 g deixa a carta firme, mas sulfite comum funciona.'
    ),
    /** Linha extra no rodapé. Vazio omite. */
    footerNote: optText(
      'MAIL_FOOTER_NOTE',
      'Material educativo. Em emergência real, acione SAMU 192, Bombeiros 193 ou Polícia 190.'
    ),
    /** Rótulo do bônus. Só aparece se DELIVERY_BONUS_URL estiver preenchido. */
    bonusTitle: optText('BONUS_TITLE', 'Plano Impresso Pronto'),
    bonusText: optText(
      'BONUS_TEXT',
      'Índice das 300 cartas, o Plano da Família para preencher e o guia de impressão.'
    ),
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
