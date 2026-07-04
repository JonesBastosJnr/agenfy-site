# Agenfy — Landing page + lista de espera (Cloudflare Pages)

Este pacote tem tudo que você precisa para publicar a landing page em `agenfy.app`
com a lista de espera funcionando de verdade, guardada no Cloudflare (KV Storage),
sem depender de nenhum serviço de terceiro.

```
agenfy-site/
├── index.html                 → a landing page
├── functions/
│   └── api/
│       └── waitlist.js        → a Cloudflare Pages Function (backend da lista de espera)
└── README.md                  → este arquivo
```

## Como funciona

- `POST /api/waitlist` — chamado pelo formulário do site. Valida o e-mail, evita
  duplicados e ignora bots (via campo honeypot escondido no formulário).
- `GET /api/waitlist?token=SEU_TOKEN` — retorna a lista de e-mails cadastrados em
  JSON. Protegido por um token que só você conhece.
- `GET /api/waitlist?token=SEU_TOKEN&format=csv` — mesma coisa, mas baixa um CSV
  (bom para importar numa planilha ou disparar uma campanha de e-mail depois).

Os e-mails ficam salvos num **KV Namespace** — um banco de chave-valor simples do
Cloudflare, sem custo para o volume que vocês vão ter no início (o plano gratuito
cobre até 100 mil leituras e 1.000 escritas por dia).

---

## Passo a passo para publicar

### 1. Criar o KV Namespace
No painel do Cloudflare: **Workers & Pages → KV → Create a namespace**.
Dê o nome `AGENFY_WAITLIST` (ou o nome que preferir) e clique em criar.

### 2. Criar o projeto Pages
Se ainda não existe: **Workers & Pages → Create → Pages**. Você pode:
- **Conectar um repositório Git** (recomendado — todo `git push` já publica sozinho), ou
- **Fazer upload direto** desta pasta (`Direct Upload`), se preferir publicar manualmente por enquanto.

Aponte o domínio customizado do projeto para `agenfy.app` (que vocês já registraram
no Cloudflare — em **Custom domains** dentro do próprio projeto Pages).

### 3. Vincular o KV Namespace ao projeto
Dentro do projeto Pages: **Settings → Functions → KV namespace bindings → Add binding**.
- Variable name: `WAITLIST_KV`
- KV namespace: selecione o `AGENFY_WAITLIST` criado no passo 1

⚠️ Repita esse binding tanto para o ambiente de **Production** quanto de **Preview**
(o Cloudflare pede isso separadamente).

### 4. Criar o token de administrador
Ainda em **Settings → Environment variables**, adicione uma variável:
- Nome: `ADMIN_TOKEN`
- Valor: qualquer senha longa e aleatória, só sua (ex: gere uma em
  [1password.com/password-generator](https://1password.com/password-generator/) ou similar)
- Marque como **Secret** (encrypted) YpZ0JqDMjBmihac4DQnV

É esse token que protege a listagem de e-mails — sem ele, ninguém consegue ver
quem se cadastrou.

### 5. Publicar
- Se conectou via Git: dê um `git push` com esta pasta e o Cloudflare publica sozinho.
- Se for Direct Upload: arraste esta pasta inteira no painel do Pages.

Pronto — `https://agenfy.app` já deve estar no ar com o formulário funcionando.

---

## Como ver quem se cadastrou

Depois de publicado, acesse no navegador (ou via `curl`):

```
https://agenfy.app/api/waitlist?token=SEU_ADMIN_TOKEN
```

Para baixar como planilha (CSV):

```
https://agenfy.app/api/waitlist?token=SEU_ADMIN_TOKEN&format=csv
```

---

## Testar localmente antes de publicar (opcional)

Se quiser rodar tudo na sua máquina antes de subir:

```bash
npm install -g wrangler
cd agenfy-site
wrangler pages dev . --kv=WAITLIST_KV --binding ADMIN_TOKEN=teste123
```

Isso abre o site em `http://localhost:8788` com uma versão local do KV
(os dados ficam só na sua máquina, não vão para produção).

---

## Notas de segurança e limites já embutidos no código

- **Honeypot anti-spam**: os formulários têm um campo escondido (`company`) que
  fica invisível para humanos, mas bots de spam costumam preencher. Se vier
  preenchido, o e-mail é silenciosamente descartado (o visitante nem percebe).
- **Deduplicação**: e-mails são normalizados em minúsculas antes de salvar, então
  `Carla@Teste.com` e `carla@teste.com` contam como o mesmo cadastro.
- **Token de leitura**: sem o `ADMIN_TOKEN` correto, o endpoint `GET` sempre
  retorna 401 — ninguém além de você consegue ver a lista.

Se no futuro o volume de spam aumentar, o próximo passo natural é adicionar o
**Cloudflare Turnstile** (captcha gratuito e invisível do próprio Cloudflare) — é
uma extensão simples do que já está aqui, e posso te ajudar a adicionar quando
precisar.
