import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/**
 * Idempotência. A AbacatePay reenvia o webhook quando não recebe 200 — sem isso,
 * o comprador levaria o mesmo e-mail várias vezes.
 *
 * O registro autoritativo das vendas é a própria AbacatePay; aqui guardamos só o
 * suficiente para não entregar duas vezes e para auditar o que saiu.
 */

const ARQUIVO = path.join(config.dataDir, 'entregas.jsonl');

export type Entrega = {
  orderId: string;
  email: string;
  nome: string;
  produtoId: string;
  enviadoEm: string;
  messageId?: string;
};

const jaEntregue = new Set<string>();
let persistenciaOk = false;

export function iniciarStore(): { persistente: boolean; carregadas: number; aviso?: string } {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    if (fs.existsSync(ARQUIVO)) {
      const linhas = fs.readFileSync(ARQUIVO, 'utf8').split('\n').filter(Boolean);
      for (const linha of linhas) {
        try {
          const e = JSON.parse(linha) as Entrega;
          if (e.orderId) jaEntregue.add(e.orderId);
        } catch {
          // linha corrompida não impede o serviço de subir
        }
      }
    }
    // confirma que dá para escrever de verdade, não só criar o diretório
    fs.appendFileSync(ARQUIVO, '');
    persistenciaOk = true;
    return { persistente: true, carregadas: jaEntregue.size };
  } catch (err) {
    persistenciaOk = false;
    return {
      persistente: false,
      carregadas: 0,
      aviso:
        `sem persistência em ${config.dataDir} (${(err as Error).message}). ` +
        'A idempotência vale só enquanto o container viver: um redeploy pode reenviar e-mails. ' +
        'Monte um volume nesse caminho no EasyPanel.',
    };
  }
}

export function foiEntregue(orderId: string): boolean {
  return jaEntregue.has(orderId);
}

export function registrarEntrega(e: Entrega): void {
  jaEntregue.add(e.orderId);
  if (!persistenciaOk) return;
  try {
    fs.appendFileSync(ARQUIVO, JSON.stringify(e) + '\n', 'utf8');
  } catch (err) {
    console.error('[store] falha ao gravar entrega', { orderId: e.orderId, erro: (err as Error).message });
  }
}

export function totalEntregas(): number {
  return jaEntregue.size;
}
