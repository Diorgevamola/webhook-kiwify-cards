# Webhook Kiwify — 300 Cards de Segurança Familiar

Recebe o webhook de compra aprovada da Kiwify e entrega o produto por e-mail.

```
Kiwify (compra aprovada) → POST /webhook/kiwify → valida assinatura
                                                → envia e-mail com o link do Drive
                                                → registra para não enviar duas vezes
```

## Rotas

| Rota | Método | Função |
|---|---|---|
| `/webhook/kiwify` | POST | Endpoint a cadastrar na Kiwify |
| `/health` | GET | Healthcheck e total de entregas |
| `/` | GET | Identificação do serviço |

## Decisões de projeto

**Responde 200 antes de enviar o e-mail.** A Kiwify reenvia quando não recebe
resposta rápida; segurar a conexão esperando o SMTP geraria retry e e-mail
duplicado.

**Falha de envio não marca como entregue.** Assim o retry da Kiwify tenta de
novo, em vez de o comprador ficar sem o produto silenciosamente.

**Assinatura aceita SHA-1 e SHA-256.** A documentação pública da Kiwify não fixa
o algoritmo. O serviço testa os dois, registra qual bateu e rejeita o que não
bater. Comparação em tempo constante.

**Corpo bruto preservado.** Reserializar o JSON mudaria os bytes e quebraria a
assinatura.

## Variáveis de ambiente

Ver `.env.example`. As indispensáveis:

| Variável | Para quê |
|---|---|
| `KIWIFY_WEBHOOK_TOKEN` | validar a assinatura (mesmo valor do painel) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | envio |
| `MAIL_FROM_EMAIL` | remetente |
| `DELIVERY_URL` | link do Google Drive com o produto |
| `PUBLIC_URL` | URL do serviço — **trocar aqui quando tiver domínio próprio** |

O serviço sobe mesmo com configuração faltando, mas registra no log exatamente
o que falta e por quê. Confira o log após o primeiro deploy.

## Persistência

O controle de duplicidade fica em `DATA_DIR` (padrão `/data`), uma linha JSON
por entrega. **Monte um volume nesse caminho no EasyPanel** — sem ele, um
redeploy zera o registro e um retry antigo pode reenviar e-mail.

## Desenvolvimento

```bash
npm install
npm run build
node dist/selftest.js   # 19 testes de assinatura, parse e idempotência
node dist/server.js
```

## Primeiro webhook real

Se a assinatura for rejeitada, o log mostra o formato recebido (chaves da query
e headers) sem aceitar a requisição. Ajuste e mantenha
`KIWIFY_STRICT_SIGNATURE=true`.
