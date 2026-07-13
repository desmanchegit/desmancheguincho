# Central dos Desmanches

> Marketplace nacional que conecta proprietários de veículos a desmanches credenciados e guinchos parceiros — pedidos de peças, negociações, chat em tempo real e cobrança automatizada em uma única plataforma.

---

## Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Papéis de Usuário](#papéis-de-usuário)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Monorepo](#estrutura-do-monorepo)
- [Arquitetura](#arquitetura)
- [Banco de Dados](#banco-de-dados)
- [Autenticação](#autenticação)
- [Pagamentos — Asaas](#pagamentos--asaas)
- [Armazenamento de Arquivos](#armazenamento-de-arquivos)
- [API — Endpoints](#api--endpoints)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Instalação e Execução](#instalação-e-execução)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Fluxo de Negócio](#fluxo-de-negócio)
- [Modelo de Cobrança](#modelo-de-cobrança)
- [Decisões de Arquitetura](#decisões-de-arquitetura)

---

## Visão Geral

A **Central dos Desmanches** é uma plataforma B2C/B2B que resolve um problema claro no mercado de autopeças usado: a dificuldade de encontrar peças específicas, comparar preços e fechar negócios com segurança.

**Para o cliente:** cria um pedido com foto e dados do veículo, recebe propostas de múltiplos desmanches e negocia diretamente via chat ou WhatsApp.

**Para o desmanche:** acessa um mural de pedidos filtrado por tipo de veículo, envia propostas e gerencia o ciclo completo da negociação — desde o primeiro contato até a entrega confirmada.

**Para o guincho:** cadastra-se como provedor de serviço de reboque, aparece no catálogo público com filtro por cidade/estado e recebe contato direto via WhatsApp.

---

## Funcionalidades

### Plataforma Pública
- Landing page com estatísticas em tempo real (desmanches online, pedidos do dia, negociações ativas)
- Catálogo de guinchos com busca por cidade e estado + mapa
- Cadastro de clientes com validação de e-mail
- Cadastro de desmanches com verificação de CNPJ via API da Receita Federal
- Cadastro de guinchos com escolha de plano (anual ou mensal)
- Termos de uso, política de privacidade e contrato de serviço por modal

### Painel do Cliente
- Meu Painel — visão geral de pedidos e negociações abertas
- Criar pedido de peças — wizard multi-etapas com foto do veículo, tipo, marca, modelo e ano
- Meus Pedidos — acompanhamento de status por item
- Propostas — comparação de propostas recebidas dos desmanches
- Negociações — histórico e status de cada negociação (aberta, em negociação, enviada, concluída)
- Chat em tempo real — por negociação, com contagem de não lidos
- Perfil — edição de dados pessoais, endereço e WhatsApp
- Sugestões e Reclamações

### Painel do Desmanche
- Visão Geral — KPIs financeiros, negociações ativas, alertas de documentação
- Mural de Pedidos — feed filtrado por tipo de veículo, com badge de novos pedidos
- Minhas Negociações — gerenciamento de propostas enviadas e respostas dos clientes
- Meus Anúncios — peças em estoque anunciadas proativamente
- Mensagens — chat com badge de não lidos por sala
- Minha Documentação — upload e controle de validade de documentos obrigatórios (Detran, CNPJ, etc.)
- Assinatura & Faturas — histórico de transações, teto mensal e status do plano
- Perfil da Empresa — edição de dados, logo, endereço e tipos de veículos atendidos
- Alertas automáticos de vencimento de licença (configurável em dias)

### Painel Administrativo
- Visão Geral — métricas consolidadas e live ticker com dados em tempo real
- Desmanches — listagem, filtro, busca e acesso a perfil detalhado
- Pessoas Cadastradas — clientes, filtros e detalhes de perfil
- Anúncios / Pedidos — pedidos em negociação, com badge de pendências
- Assinaturas & Receitas — faturamento, histórico de cobranças
- Aprovações — fila de desmanches e guinchos aguardando ativação (com badge)
- Relatórios — exportação e análise de dados
- Conteúdo do Site — logos de marcas de veículos, textos e configurações visuais
- Moderação — negociações em disputa
- Guinchos — listagem e aprovação de prestadores
- Reclamações — fila de suporte com badge
- Configurações — parâmetros globais (teto de cobrança, prazo de revisão, alertas, integração Asaas)
- Log de Atividades — auditoria completa de ações na plataforma
- Manual do Sistema
- Permissões — gestão de acesso por abas para admins secundários (super-admin)

### Painel do Guincho
- Status — resumo do perfil, status de aprovação e localização
- Meu Perfil — edição de dados, foto, raio de atendimento e endereço

---

## Papéis de Usuário

| Papel | Autenticação | Cadastro |
|-------|-------------|----------|
| **Cliente** | JWT via `/api/auth/login` | `/api/auth/register` |
| **Desmanche** | JWT via `/api/auth/login` | `/api/desmanches/register` |
| **Guincho** | JWT dedicado via `/api/guinchos/login` | `/api/guinchos/register` |
| **Admin** | JWT via `/api/auth/login` + `type: admin` | Criação manual no banco |

---

## Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| React | 18 | UI principal |
| TypeScript | 5.9 | Tipagem estática |
| Vite | 6 | Build e dev server |
| Tailwind CSS | 3 | Estilização utilitária |
| shadcn/ui | — | Componentes de interface |
| Tanstack Query | 5 | Data fetching, cache e mutações |
| Wouter | 3 | Roteamento client-side |
| Framer Motion | — | Animações |
| Lucide React | — | Ícones |
| Zod | 3 | Validação de formulários |

### Backend
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Node.js | 24 | Runtime |
| Express | 5 | Framework HTTP |
| TypeScript | 5.9 | Tipagem estática |
| better-sqlite3 | — | Driver SQLite síncrono |
| Drizzle ORM | — | Query builder e schema |
| drizzle-zod | — | Geração de schemas Zod a partir do DB |
| jsonwebtoken | — | Geração e validação de JWT |
| bcryptjs | — | Hash de senhas |
| pino | — | Logger estruturado |
| esbuild | — | Bundler para produção |

### Infraestrutura e Integrações
| Serviço | Finalidade |
|---------|-----------|
| **Asaas** | Gateway de pagamento (cobranças avulsas e assinaturas recorrentes) |
| **ViaCEP** | Autopreenchimento de endereço por CEP |
| **Receita Federal API** | Validação e consulta de CNPJ |
| **OpenAPI + Orval** | Geração automática de hooks React Query e schemas Zod a partir do contrato de API |

---

## Estrutura do Monorepo

```
central-desmanches/
├── artifacts/
│   ├── api-server/              # Backend Express
│   │   └── src/
│   │       ├── routes/
│   │       │   └── routes.ts    # Todos os endpoints REST
│   │       ├── storage.ts       # Camada de acesso ao banco (SQLite)
│   │       ├── asaas.ts         # Integração Asaas (cobranças e assinaturas)
│   │       ├── email.ts         # Envio de e-mails transacionais
│   │       └── index.ts         # Bootstrap do servidor
│   │
│   ├── central-desmanches/      # Frontend React/Vite
│   │   └── src/
│   │       ├── pages/           # Páginas principais e dashboards
│   │       ├── components/      # Componentes reutilizáveis por domínio
│   │       │   ├── admin/
│   │       │   ├── client/
│   │       │   ├── desmanche/
│   │       │   ├── guincho/
│   │       │   ├── chat/
│   │       │   └── ui/          # shadcn/ui
│   │       ├── hooks/           # Custom hooks
│   │       └── lib/             # Utilitários, auth, queryClient
│   │
│   └── mockup-sandbox/          # Servidor Vite para preview de componentes
│
├── lib/
│   ├── db/                      # Schema Drizzle compartilhado
│   │   └── src/schema/schema.ts
│   ├── api-spec/                # Contrato OpenAPI (openapi.yaml + orval.config.ts)
│   ├── api-client-react/        # Hooks React Query gerados pelo Orval
│   ├── api-zod/                 # Schemas Zod gerados pelo Orval
│   └── object-storage-web/      # Utilitário de upload de arquivos para o frontend
│
├── scripts/                     # Scripts utilitários (migrações manuais, seeds)
├── pnpm-workspace.yaml          # Configuração do workspace pnpm
├── tsconfig.base.json           # TypeScript base compartilhado
└── package.json                 # Tarefas raiz (typecheck, build)
```

---

## Arquitetura

```
┌──────────────────────────────────────────────────┐
│                    Reverse Proxy                  │
│          (path-based routing por artifact)        │
├──────────────┬───────────────────────────────────┤
│  /           │  Frontend React (Vite)             │
│  /api        │  Backend Express                   │
└──────────────┴───────────────────────────────────┘
                        │
              ┌─────────▼─────────┐
              │   Express App      │
              │   routes.ts (~3.5k)│
              │   storage.ts       │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │   SQLite (arquivo) │
              │   better-sqlite3   │
              │   Drizzle ORM      │
              └───────────────────┘
```

O roteamento entre o frontend e o backend usa prefixos de caminho — o proxy repassa `/api/*` para o Express e todo o resto para o Vite. Em produção, o mesmo modelo se aplica.

---

## Banco de Dados

O banco é **SQLite** gerenciado via **Drizzle ORM** com o driver `better-sqlite3`. O schema vive em `lib/db/src/schema/schema.ts` e é compartilhado entre os packages do workspace.

### Principais tabelas

| Tabela | Descrição |
|--------|-----------|
| `users` | Clientes e admins |
| `desmanches` | Empresas de desmanche credenciadas |
| `guinchos` | Prestadores de serviço de reboque |
| `orders` | Pedidos de peças criados por clientes |
| `order_items` | Itens individuais dentro de cada pedido |
| `proposals` | Propostas de desmanches para itens de pedido |
| `negotiations` | Ciclo de negociação entre cliente e desmanche |
| `chat_rooms` | Salas de chat por negociação |
| `chat_messages` | Mensagens de chat |
| `desmanche_documents` | Documentos obrigatórios com validade |
| `desmanche_billing` | Estado de cobrança mensal por desmanche |
| `billing_transactions` | Histórico de cobranças por negociação |
| `subscription_plans` | Planos de assinatura disponíveis |
| `system_settings` | Configurações globais da plataforma |
| `activity_log` | Auditoria de ações administrativas |
| `complaints` | Reclamações de clientes/desmanches |
| `ads` | Anúncios proativos de peças em estoque |

### Migrações

O projeto usa SQLite diretamente. Para aplicar mudanças de schema em desenvolvimento, execute scripts manuais via `tsx` a partir do diretório `artifacts/api-server`:

```bash
# Exemplo: adicionar coluna
cd artifacts/api-server
../../scripts/node_modules/.bin/tsx - << 'EOF'
import { db } from "./src/storage";
import { sql } from "drizzle-orm";
db.run(sql`ALTER TABLE nome_tabela ADD COLUMN nova_coluna TEXT`);
process.exit(0);
EOF
```

---

## Autenticação

A plataforma usa **JWT** (JSON Web Tokens) para todos os papéis.

- **Clientes e Admins:** token no header `Authorization: Bearer <token>`, gerado em `/api/auth/login`
- **Desmanches:** mesmo fluxo, type `desmanche` no payload
- **Guinchos:** token dedicado armazenado em `localStorage` (`guincho_token`), gerado em `/api/guinchos/login`

O payload do token inclui `{ id, email, type }`. Middleware de autenticação valida o token em todas as rotas protegidas.

Senhas são armazenadas com hash **bcrypt** (10 rounds).

---

## Pagamentos — Asaas

Toda a lógica de cobrança usa a **API Asaas** (`asaas.ts`).

### Guinchos

| Plano | Valor | Tipo Asaas |
|-------|-------|-----------|
| Anual | R$ 80,00 | Cobrança avulsa (`/payments`) |
| Mensal | R$ 10,00/mês | Assinatura recorrente (`/subscriptions`, ciclo MONTHLY) |

O guincho escolhe o plano durante o cadastro. Após confirmação de pagamento via webhook Asaas (`PAYMENT_CONFIRMED`), o status muda automaticamente de `pending` para `active`.

### Desmanches

| Modelo | Valor | Teto |
|--------|-------|------|
| Por operação | R$ 25,00/negociação concluída | R$ 350,00/mês |

Ao atingir o teto mensal, as demais negociações do mês são isentas. O ciclo reinicia no primeiro dia do mês seguinte.

### Webhook

Endpoint: `POST /api/billing/webhook/asaas`

Eventos tratados:
- `PAYMENT_CONFIRMED` → ativa guincho ou registra transação de desmanche
- `PAYMENT_RECEIVED` → mesmo tratamento de confirmação

---

## Armazenamento de Arquivos

Uploads são salvos no sistema de arquivos local via **Object Storage** (configurado pelas variáveis de ambiente `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`).

O frontend usa o package `@workspace/object-storage-web` para upload direto. As URLs retornadas seguem o padrão `/api/storage/<path>`.

Tipos de arquivo suportados:
- Fotos de guinchos e desmanches (perfil/logo)
- Documentos obrigatórios dos desmanches (PDF, imagem)
- Fotos de veículos nos pedidos de peças

---

## API — Endpoints

### Autenticação
```
POST   /api/auth/register                 Cadastro de cliente
POST   /api/auth/login                    Login de cliente/admin
POST   /api/auth/resend-verification      Reenviar e-mail de verificação
GET    /api/auth/verify-email             Verificar e-mail por token
POST   /api/auth/forgot-password          Solicitar reset de senha
POST   /api/auth/reset-password           Redefinir senha
GET    /api/auth/me                       Dados do usuário logado
```

### Clientes / Usuários
```
GET    /api/users/me                      Perfil do usuário
PATCH  /api/users/me                      Atualizar perfil
```

### Desmanches
```
GET    /api/desmanches                    Listagem pública
POST   /api/desmanches/register           Cadastro de desmanche
GET    /api/desmanches/me                 Perfil do desmanche logado
PATCH  /api/desmanches/me                 Atualizar perfil
GET    /api/desmanches/:id                Detalhes de um desmanche
```

### Guinchos
```
GET    /api/guinchos                      Listagem pública (com filtros cidade/estado)
POST   /api/guinchos/register             Cadastro de guincho
POST   /api/guinchos/login                Login de guincho
GET    /api/guinchos/me                   Perfil do guincho logado
PATCH  /api/guinchos/me                   Atualizar perfil
```

### Pedidos e Itens
```
GET    /api/orders                        Listagem (admin/desmanche)
POST   /api/orders                        Criar pedido
GET    /api/orders/my                     Meus pedidos (cliente)
GET    /api/orders/:id                    Detalhes do pedido
PATCH  /api/order-items/:id               Atualizar item
```

### Propostas
```
POST   /api/proposals                     Enviar proposta
GET    /api/proposals/:id                 Detalhes da proposta
PATCH  /api/proposals/:id                 Aceitar/recusar proposta
```

### Negociações
```
GET    /api/negotiations                  Listagem
GET    /api/negotiations/:id              Detalhes
PATCH  /api/negotiations/:id/status       Atualizar status
GET    /api/negotiations/:id/messages     Mensagens do chat
POST   /api/negotiations/:id/messages     Enviar mensagem
```

### Chat
```
GET    /api/chat/rooms                    Salas de chat do usuário
GET    /api/chat/rooms/:id/messages       Mensagens de uma sala
POST   /api/chat/rooms/:id/messages       Enviar mensagem
PATCH  /api/chat/rooms/:id/read           Marcar como lido
```

### Billing
```
POST   /api/billing/webhook/asaas         Webhook de eventos Asaas
GET    /api/billing/desmanche             Status de cobrança do desmanche
GET    /api/billing/transactions          Histórico de transações
```

### Admin
```
GET    /api/dashboard/stats               Métricas gerais
GET    /api/admin/desmanches              Listagem administrativa
PATCH  /api/admin/desmanches/:id/approve  Aprovar desmanche
PATCH  /api/admin/desmanches/:id/reject   Rejeitar desmanche
GET    /api/admin/guinchos                Listagem de guinchos
PATCH  /api/admin/guinchos/:id/approve    Aprovar guincho
GET    /api/admin/users                   Usuários cadastrados
GET    /api/admin/complaints              Reclamações
PATCH  /api/admin/complaints/:id          Atualizar reclamação
GET    /api/admin/activity-log            Log de atividades
GET    /api/admin/settings                Configurações do sistema
PATCH  /api/admin/settings                Atualizar configurações
GET    /api/admin/license-alerts          Alertas de documentação vencendo
GET    /api/admin/negotiations/moderation Negociações em moderação
```

### Utilitários
```
GET    /api/healthz                       Health check
GET    /api/site-stats/real               Estatísticas públicas em tempo real
GET    /api/storage/*                     Arquivos uploaded
```

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Banco de dados (caminho do arquivo SQLite)
DATABASE_PATH=./data/central.db

# Segurança
JWT_SECRET=sua_chave_secreta_longa_e_aleatoria
SESSION_SECRET=outra_chave_secreta_para_sessoes

# Asaas — Gateway de Pagamento
ASAAS_API_KEY=sua_chave_api_asaas
ASAAS_ENVIRONMENT=sandbox          # ou "production"

# Object Storage
DEFAULT_OBJECT_STORAGE_BUCKET_ID=seu_bucket_id
PRIVATE_OBJECT_DIR=./uploads/private
PUBLIC_OBJECT_SEARCH_PATHS=./uploads/public

# Servidor
PORT=5000
NODE_ENV=development
```

> **Segurança:** nunca comite o arquivo `.env` no repositório. Adicione-o ao `.gitignore`.

---

## Instalação e Execução

### Pré-requisitos

- Node.js >= 24
- pnpm >= 9

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/desmanchegit/desmancheguincho.git
cd desmancheguincho

# Instalar dependências de todos os packages
pnpm install
```

### Desenvolvimento

```bash
# Terminal 1 — API Backend
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend
pnpm --filter @workspace/central-desmanches run dev
```

O frontend estará disponível em `http://localhost:5173` e o backend em `http://localhost:5000`.

### Build de Produção

```bash
# Typecheck + build completo de todos os packages
pnpm run build
```

---

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `pnpm --filter @workspace/api-server run dev` | Inicia o servidor de desenvolvimento (porta 5000) |
| `pnpm --filter @workspace/central-desmanches run dev` | Inicia o frontend (porta 5173) |
| `pnpm run typecheck` | Typecheck completo de todos os packages |
| `pnpm run typecheck:libs` | Typecheck apenas das libs compartilhadas |
| `pnpm run build` | Build de produção completo |
| `pnpm --filter @workspace/api-spec run codegen` | Regenera hooks React Query e schemas Zod a partir do OpenAPI |
| `pnpm --filter @workspace/api-server run build` | Build do servidor para produção (bundle CJS via esbuild) |

---

## Fluxo de Negócio

### Ciclo de Pedido de Peças

```
Cliente cria pedido
       │
       ▼
Desmanches recebem no Mural de Pedidos
       │
       ▼
Desmanche envia proposta
       │
       ├──► Cliente aceita proposta
       │           │
       │           ▼
       │    Negociação aberta (chat interno)
       │           │
       │           ▼
       │    Desmanche marca como "Enviado"
       │           │
       │           ▼
       │    Cliente confirma recebimento → Negociação Concluída
       │           │
       │           ▼
       │    Cobrança gerada para o desmanche (R$ 25)
       │
       └──► Cliente recusa proposta → Aguarda novas propostas
```

### Cadastro de Guincho

```
Preenche formulário → Aceita contrato de serviço
       │
       ▼
Escolhe plano (Anual R$80 ou Mensal R$10)
       │
       ▼
Sistema cria cobrança ou assinatura no Asaas
       │
       ▼
Usuário paga (PIX, boleto ou cartão)
       │
       ▼
Webhook Asaas notifica pagamento confirmado
       │
       ▼
Status muda automaticamente para "active"
       │
       ▼
Guincho aparece no catálogo público
```

---

## Modelo de Cobrança

### Desmanches — Cobrança por Operação

- **Valor por negociação concluída:** R$ 25,00
- **Teto mensal:** R$ 350,00
- **Após atingir o teto:** negociações adicionais no mês são gratuitas
- **Ciclo:** reinicia no 1º dia de cada mês

O valor do teto é configurável pelo admin em **Configurações do Sistema** (`monthlyCapAmount`). O valor por transação também é configurável (`perTransactionAmount`).

### Guinchos — Planos de Acesso

| Plano | Valor | Renovação |
|-------|-------|-----------|
| Anual | R$ 80,00 | Manual (cobrança avulsa) |
| Mensal | R$ 10,00 | Automática (assinatura recorrente) |

---

## Decisões de Arquitetura

**SQLite em produção**
Escolha deliberada para simplificar o deployment. `better-sqlite3` é síncrono, rápido para cargas típicas de marketplace de médio porte, e elimina a necessidade de gerenciar um servidor de banco de dados separado. A migração para PostgreSQL é viável com mínima alteração no código (Drizzle suporta ambos).

**Contrato OpenAPI + Orval**
A API é definida primeiro em `lib/api-spec/openapi.yaml`. O Orval gera hooks React Query tipados e schemas Zod automaticamente. Isso garante sincronização entre backend e frontend e elimina erros de tipagem manual na camada de comunicação.

**Autenticação separada para Guinchos**
Guinchos têm um JWT e fluxo de autenticação separados dos usuários convencionais. Isso permite escalabilidade independente e controle de acesso mais granular para este tipo específico de prestador de serviço.

**Chat interno com gate para WhatsApp**
O contato via WhatsApp só é liberado após uma proposta ser aceita. Esse design mantém o engajamento inicial dentro da plataforma, permitindo registro de leads e cobrança por negociação antes de o contato sair da plataforma.

**Permissões granulares para admins**
Super-admins podem criar admins secundários com acesso restrito a abas específicas (ex: apenas "Aprovações" e "Reclamações"). Isso permite delegar tarefas operacionais sem expor dados financeiros ou configurações críticas.

**Modelo de itens dentro de pedidos**
Um pedido (`order`) é um container de itens (`order_items`). Cada item representa uma peça específica e tem seu próprio ciclo de proposta e negociação independente. Isso permite que um único pedido resulte em múltiplas negociações com diferentes desmanches simultaneamente.

---

## Licença

Proprietário. Todos os direitos reservados © Central dos Desmanches.
