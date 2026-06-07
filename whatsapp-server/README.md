# WhatsApp Server

Servidor Node.js persistente com Baileys para o CRM.

## Stack
- Express + TypeScript
- @whiskeysockets/baileys
- QRCode (geração de QR Code real)

## Rotas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /health | — | Status do servidor |
| GET | /sessions/:restaurantId/status | Bearer | Status da sessão |
| POST | /sessions/:restaurantId/connect | Bearer | Inicia conexão + QR |
| POST | /sessions/:restaurantId/send | Bearer | Envia mensagem |
| POST | /sessions/:restaurantId/logout | Bearer | Desconecta sessão |

## Variáveis de ambiente

```
PORT=3001
WHATSAPP_SERVER_SECRET=senha_longa_aleatoria
SESSION_DIR=./sessions
NODE_ENV=production
```

## Deploy no Railway

1. Criar novo projeto no Railway
2. Apontar para o diretório `whatsapp-server`
3. Adicionar as variáveis acima
4. Railway roda automaticamente `npm run build && npm start`
5. Copiar a URL gerada para o Vercel como `WHATSAPP_SERVER_URL`

## Desenvolvimento local

```bash
cd whatsapp-server
npm install
cp .env.example .env
# editar .env com seu secret
npm run dev
```
