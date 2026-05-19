# CorretoAI

Sistema web para cadastro de provas, gabaritos, seções/disciplinas e correção automática de cartões-resposta (OMR + IA).

Este guia é para quem está entrando no projeto pela primeira vez e precisa rodar tudo na máquina local.

---

## O que você vai subir

Em desenvolvimento local existem **dois processos**:

| Processo | Comando | Porta | Função |
|----------|---------|-------|--------|
| API | `npm run api` | `3001` | Backend (rotas `/api/*`, banco, autenticação) |
| Frontend | `npm run dev` | `5173` (padrão Vite) | Interface React |

O Vite faz proxy de `/api` para `http://127.0.0.1:3001` (ver [`vite.config.js`](vite.config.js)).

---

## Pré-requisitos

1. **Git** — para clonar o repositório
2. **Node.js 24.x** — exigido em [`package.json`](package.json) (`engines.node`)
   - Verifique: `node -v` (deve mostrar `v24.x.x`)
   - Download: https://nodejs.org/
3. **Conta no Neon** (PostgreSQL na nuvem) — https://neon.tech  
   - Alternativa: qualquer PostgreSQL acessível, desde que a connection string funcione com SSL

---

## Passo a passo (primeira execução)

### 1. Clonar e entrar na pasta

```bash
git clone <URL_DO_REPOSITORIO>
cd CorrecaoGabarito
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Criar o banco no Neon

1. Crie um projeto no [Neon](https://console.neon.tech/)
2. Copie a **connection string** (formato `postgresql://usuario:senha@host/neondb?sslmode=require`)
3. Guarde — será o valor de `DATABASE_URL`

### 4. Configurar variáveis de ambiente

Na **raiz do projeto**, crie o arquivo `.env.local` (não commitar — já está no `.gitignore`):

```env
# Obrigatório
DATABASE_URL=postgresql://usuario:senha@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=troque-por-uma-string-longa-e-aleatoria

# Opcional — correção com OpenAI (upload de cartões)
OPENAI_API_KEY=sk-...

# Opcional — debug da leitura OMR
OMR_DEBUG=0

# Opcional — webhook interno de reprocessamento
REPROCESS_WEBHOOK_SECRET=
```

| Variável | Obrigatória? | Descrição |
|----------|--------------|-----------|
| `DATABASE_URL` | Sim | Connection string PostgreSQL (Neon) |
| `JWT_SECRET` | Sim | Chave para assinar tokens de login |
| `OPENAI_API_KEY` | Não | Necessária para correção via IA nos cartões |
| `OMR_DEBUG` | Não | `1` ativa logs extras do OMR |
| `REPROCESS_WEBHOOK_SECRET` | Não | Só para webhook de reprocessamento |

> **Importante:** o servidor local (`server.local.js`) **lê apenas** `.env.local`. Sem esse arquivo, `npm run api` falha ao iniciar.

### 5. Rodar as migrations do banco

Cria as tabelas em `db/migrations/`:

```bash
npm run migrate
```

Saída esperada: mensagens do tipo `applied: 001_create_users.sql`, etc.

Se der erro de variável ausente, confira se `DATABASE_URL` está correto no `.env.local`.

### 6. Criar o primeiro usuário

A tela de login **não** tem cadastro visual. Use a API de registro (com a API já rodando — passo 7) ou faça o registro antes de subir o front.

**PowerShell (Windows):**

```powershell
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3001/api/auth/register" `
  -ContentType "application/json" `
  -Body '{"nome":"Dev Local","email":"dev@local.test","senha":"senha123"}'
```

**curl (Git Bash / Linux / macOS):**

```bash
curl -X POST http://127.0.0.1:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nome":"Dev Local","email":"dev@local.test","senha":"senha123"}'
```

Resposta esperada: JSON com `token` e `user`.

### 7. Subir a API (terminal 1)

```bash
npm run api
```

Deve aparecer:

```text
✓ API local rodando em http://127.0.0.1:3001
  Inicie o frontend com: npm run dev
```

Deixe este terminal aberto.

### 8. Subir o frontend (terminal 2)

```bash
npm run dev
```

Abra no navegador a URL exibida (geralmente **http://localhost:5173**).

### 9. Fazer login

- Acesse `/login`
- Use o e-mail e senha criados no passo 6 (ex.: `dev@local.test` / `senha123`)

---

## Fluxo rápido no dia a dia

Depois da primeira configuração, basta:

```bash
# Terminal 1
npm run api

# Terminal 2
npm run dev
```

---

## Scripts disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| Desenvolvimento front | `npm run dev` | Vite + hot reload |
| API local | `npm run api` | Servidor Node em `127.0.0.1:3001` |
| Migrations | `npm run migrate` | Aplica SQL em `db/migrations/` |
| Reset de senha | `npm run reset-password -- email@exemplo.com novaSenha` | Atualiza senha de usuário existente |
| Build produção | `npm run build` | Gera `dist/` do frontend |
| Preview build | `npm run preview` | Preview do build estático |

---

## Estrutura do projeto (visão geral)

```text
CorrecaoGabarito/
├── src/                    # Frontend React (Vite)
│   ├── pages/              # Telas (provas, cartões, resultados…)
│   ├── components/         # UI reutilizável
│   └── hooks/              # React Query + chamadas API
├── lib/
│   ├── api-handlers/       # Handlers da API (login, provas, correções…)
│   └── api/routeTable.js   # Tabela de rotas
├── db/migrations/          # SQL versionado
├── server.local.js         # Servidor API para desenvolvimento
├── api/router.js           # Entry da API na Vercel (produção)
└── vite.config.js          # Proxy /api → localhost:3001
```

---

## Problemas comuns

### `ENOENT: no such file '.env.local'` ao rodar `npm run api`

Crie o arquivo `.env.local` na raiz com pelo menos `DATABASE_URL` e `JWT_SECRET`.

### Login retorna erro de rede / `ECONNRESET`

- A API não está rodando → execute `npm run api` **antes** do `npm run dev`
- Confirme que a API responde: http://127.0.0.1:3001/api/auth/login (deve retornar erro de método, não conexão recusada)

### `Variável de ambiente ausente: DATABASE_URL` no migrate

O script `migrate.js` lê `.env.local`. Verifique o nome do arquivo e a variável.

### `Email já cadastrado` no register

O usuário já existe. Use login ou `npm run reset-password`.

### Correção de cartões não funciona

Provavelmente falta `OPENAI_API_KEY` no `.env.local`. Sem ela, recursos que dependem da OpenAI podem falhar.

### Versão do Node incorreta

```bash
node -v
```

Instale Node **24.x**. Versões muito antigas ou incompatíveis podem quebrar dependências.

---

## Produção (referência)

O frontend é buildado com `npm run build`. A API em produção roda na **Vercel** (ver [`vercel.json`](vercel.json)), com as mesmas variáveis de ambiente configuradas no painel do projeto — não no `.env.local` da máquina.

---

## Checklist para novo dev

- [ ] Node 24 instalado (`node -v`)
- [ ] `npm install` executado
- [ ] `.env.local` criado com `DATABASE_URL` e `JWT_SECRET`
- [ ] `npm run migrate` executado sem erro
- [ ] `npm run api` rodando (terminal 1)
- [ ] `npm run dev` rodando (terminal 2)
- [ ] Usuário criado via `POST /api/auth/register`
- [ ] Login em http://localhost:5173/login funcionando

Se algo falhar fora desta lista, descreva o comando, a mensagem de erro completa e o sistema operacional ao pedir ajuda no time.
