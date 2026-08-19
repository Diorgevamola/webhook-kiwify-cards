# Webhook AbacatePay — 300 Cards de Segurança Familiar

Recebe o webhook de pagamento aprovado da AbacatePay e entrega o produto por e-mail.

```
AbacatePay (pagamento pago) → POST /webhook/abacatepay → verifica secret + HMAC
                                                       → envia e-mail com o link do Drive
                                                       → registra para não enviar duas vezes
```

## Rotas

| Rota | Método | Função |
|---|---|---|
| `/webhook/abacatepay` | POST | Endpoint a cadastrar na AbacatePay |
| `/health` | GET | Healthcheck e total de entregas |
| `/debug/ultimo` | GET | Formato do último webhook recebido (sem dados pessoais) |
| `/` | GET | Identificação do serviço |

## Decisões de projeto

**Responde 200 antes de enviar o e-mail.** A AbacatePay reenvia quando não recebe
resposta rápida; segurar a conexão esperando o SMTP geraria retry e e-mail
duplicado.

**Falha de envio não marca como entregue.** Assim o retry da AbacatePay tenta de
novo, em vez de o comprador ficar sem o produto silenciosamente.

**A barreira real é o secret da URL, não a assinatura.** A AbacatePay assina o
corpo com uma chave HMAC **pública** — a mesma para todos os integradores,
impressa na documentação. Ela prova que o corpo não foi alterado em trânsito,
mas qualquer pessoa consegue calculá-la, então não prova origem. Quem impede
requisição forjada é o `webhookSecret` da query string. As duas camadas são
exigidas juntas; o log diz qual das duas falhou.

**Corpo bruto preservado.** Reserializar o JSON mudaria os bytes e quebraria a
assinatura.

**Leitura tolerante do payload.** A documentação pública não fixa o formato de
`data` para cada evento, então o parse procura e-mail, nome e produto em vários
caminhos plausíveis. O formato que chegou de verdade aparece em `/debug/ultimo`
e no log do primeiro webhook real.

**Só `checkout.completed` e `transparent.completed` entregam.** Reembolso e
disputa são registrados e ignorados — a entrega é um link de Drive, que não teria
como ser revogado sem mudar a forma de entrega.

## Variáveis de ambiente

Ver `.env.example`. As indispensáveis:

| Variável | Para quê |
|---|---|
| `ABACATEPAY_WEBHOOK_SECRET` | validar o webhook (mesmo valor cadastrado no painel) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | envio |
| `MAIL_FROM_EMAIL` | remetente |
| `DELIVERY_URL` | link do Google Drive com o produto |
| `PUBLIC_URL` | URL do serviço — **trocar aqui quando tiver domínio próprio** |
| `ABACATEPAY_PRODUCT_ID` | opcional: só entrega compras deste produto |

O serviço sobe mesmo com configuração faltando, mas registra no log exatamente
o que falta e por quê. Confira o log após o primeiro deploy.

## Cadastro no painel da AbacatePay

Em **Integração → Webhook**, cadastre a URL com o secret na query string:

```
https://SEU-DOMINIO/webhook/abacatepay?webhookSecret=SEU_SECRET
```

O valor de `webhookSecret` precisa ser idêntico ao de `ABACATEPAY_WEBHOOK_SECRET`.

## Persistência

O controle de duplicidade fica em `DATA_DIR` (padrão `/data`), uma linha JSON
por entrega. **Monte um volume nesse caminho no EasyPanel** — sem ele, um
redeploy zera o registro e um retry antigo pode reenviar e-mail.

## Desenvolvimento

```bash
npm install
npm run build
node dist/selftest.js   # 24 testes de verificação, parse e idempotência
node dist/server.js
```

## Primeiro webhook real

Se a verificação falhar, o log e `/debug/ultimo` mostram o formato recebido
(chaves da query e headers) sem aceitar a requisição. Ajuste e mantenha
`ABACATEPAY_STRICT_SIGNATURE=true`.

## Armadilhas já encontradas neste deploy

**`NODE_ENV=production` antes do `npm install`.** O npm pula as devDependencies,
o TypeScript não é instalado e o build quebra. A variável só entra depois de
compilar — ver comentário no `Dockerfile`.

**Variáveis de ambiente gravadas em uma linha só.** Ao enviar o bloco de env
pela API do EasyPanel, as quebras precisam ser `\n` reais. Se virar uma linha
única, `PORT` recebe o resto do bloco junto, `Number()` devolve `NaN`, o Node
escuta numa porta aleatória e o proxy responde 502 para sempre — sem nenhum
erro visível. Confira com `inspectService` que o número de linhas bate.

**`dist/boot.js` é o entrypoint, não `server.js`.** Se a inicialização falhar,
ele sobe um servidor mínimo que devolve o erro e o stack em `/health` com status
500 — diagnóstico sem precisar de acesso ao painel.
