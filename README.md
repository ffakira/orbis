# API Orbis

API de backend da plataforma **Orbis**, desenvolvida com Node.js, TypeScript e Express 5.

O projeto utiliza uma arquitetura modular baseada em **Arquitetura Hexagonal (Ports and Adapters)**, PostgreSQL com Drizzle ORM e execução local ou em AWS Lambda integrada ao Amazon API Gateway.

O PostgreSQL é hospedado pela [Neon](https://neon.tech/), enquanto a infraestrutura AWS é gerenciada com Terraform.

## Tecnologias

| Categoria | Tecnologia |
|---|---|
| Runtime | Node.js 22 |
| Linguagem | TypeScript |
| Framework HTTP | Express 5 |
| Validação | Zod 4 |
| Banco de dados | PostgreSQL 18 |
| ORM | Drizzle ORM |
| Driver PostgreSQL | node-postgres (`pg`) |
| Hash de senhas | Argon2id |
| Testes | Vitest, Supertest e Testcontainers |
| Execução em nuvem | AWS Lambda |
| API Gateway | Amazon API Gateway HTTP API |
| Limitação de requisições | Amazon DynamoDB |
| Gerenciamento de segredos | AWS Secrets Manager |
| Infraestrutura como código | Terraform |
| CI/CD | GitHub Actions |
| Autenticação da CI/CD na AWS | AWS IAM OIDC |
| Serviço de e-mail | Resend |

## Começando

### Pré-requisitos

- Node.js 22 ou superior
- npm
- GNU Make
- Docker, necessário para os testes de integração
- Banco de dados PostgreSQL

O projeto utiliza Neon para hospedagem do PostgreSQL, mas qualquer instância compatível pode ser utilizada no desenvolvimento local.

### 1. Clonar o repositório

```bash
git clone https://github.com/ffakira/orbis.git
cd orbis
```

### 2. Instalar dependências

```bash
make install
```

O comando executa `npm ci` e instala as dependências definidas em `package-lock.json`.

### 3. Configurar variáveis de ambiente

Crie o arquivo local:

```bash
cp .env.example .env
```

Configure a conexão com o banco e a versão dos Termos de Serviço:

```dotenv
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

DATABASE_URL=postgresql://<usuario>:<senha>@<host>/<banco>?sslmode=require

TERMS_OF_SERVICE_VERSION=1.0
```

Substitua os valores de exemplo pelas configurações do seu ambiente.

Para executar migrações com uma conexão separada, configure opcionalmente `MIGRATION_DATABASE_URL`. Se ela não estiver definida, as migrações utilizarão `DATABASE_URL`.

Nunca versione o arquivo `.env` nem inclua credenciais no código-fonte.

### 4. Executar migrações

Gerar migrações após alterações intencionais no esquema:

```bash
npm run db:generate
```

Aplicar as migrações existentes:

```bash
npm run db:migrate
```

### 5. Iniciar o servidor

```bash
make dev
```

A API ficará disponível em `http://localhost:3000`.

## Endpoints

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Verifica se a aplicação está respondendo |
| GET | `/ready` | Verifica a conectividade com o banco |
| POST | `/identity/register` | Cadastra uma conta |
| POST | `/identity/login` | Autentica uma conta |
| POST | `/identity/verify-email` | Confirma o endereço de e-mail |
| GET | `/identity/me` | Consulta o perfil do usuário autenticado |

O endpoint `/identity/me` exige um token de acesso no formato Bearer.

## Desenvolvimento

### Comandos disponíveis

| Comando | Descrição |
|---|---|
| `make` | Exibe os comandos disponíveis |
| `make install` | Instala as dependências |
| `make dev` | Inicia o servidor de desenvolvimento |
| `make test` | Executa a suíte de testes |
| `make build` | Compila o TypeScript |
| `make package` | Gera o pacote de implantação da Lambda |
| `make clean` | Remove artefatos gerados |
| `make health` | Verifica o endpoint de saúde implantado |
| `make ready` | Verifica a API e a conexão com o banco |
| `make check` | Executa as duas verificações |

Comandos do banco:

| Comando | Descrição |
|---|---|
| `npm run db:generate` | Gera migrações |
| `npm run db:migrate` | Aplica migrações |
| `npm run db:studio` | Abre o Drizzle Studio |

### Testes e compilação

```bash
make test
make build
```

Os testes de integração utilizam Testcontainers para provisionar instâncias PostgreSQL descartáveis. O Docker precisa estar em execução.

Nunca execute testes automatizados de integração contra bancos de produção.

## Arquitetura

A aplicação segue Arquitetura Hexagonal, mantendo as regras de negócio independentes dos mecanismos de entrega, frameworks e implementações de infraestrutura.

As principais fronteiras são:

- **Bootstrap:** composição de dependências e inicialização dos componentes.
- **Delivery:** pontos de entrada HTTP e outros mecanismos de entrega.
- **Modules:** capacidades de negócio, cada uma com seu domínio, aplicação e infraestrutura específica.
- **Infrastructure:** recursos técnicos compartilhados, como conexão com banco, segredos e integrações externas.

Documentação específica:

- [Arquitetura](docs/architecture.md)
- [Identity](docs/identity.md)
- [Outbox](docs/outbox.md)
- [Implantação e infraestrutura](docs/deployment.md)

## Escopo implementado

A implementação atual inclui:

- Arquitetura modular baseada em portas e adaptadores.
- Cadastro de usuários.
- Normalização e unicidade de e-mail.
- Hash de senha com Argon2id.
- Registro transacional do aceite dos Termos de Serviço.
- Emissão e verificação de tokens de acesso.
- Verificação de endereço de e-mail.
- Verificação do estado atual da conta em rotas autenticadas.
- Persistência PostgreSQL com Drizzle ORM.
- Outbox transacional e processamento assíncrono.
- Entrega de e-mails por meio do Resend.
- Testes unitários e de integração com PostgreSQL descartável.
- Execução em AWS Lambda e integração com API Gateway.
- Limitação de requisições de cadastro com DynamoDB.
- Gerenciamento de segredos com AWS Secrets Manager.
- Infraestrutura gerenciada com Terraform.
- CI/CD com GitHub Actions e AWS OIDC.
- Aprovação antes da implantação em produção e verificações posteriores à implantação.

O escopo de negócio continua em evolução. Consulte os documentos dos módulos para conhecer os fluxos implementados e seus limites atuais.

## Licença

Ainda não foi definida uma licença para este repositório.
