# Orbis API

Backend API da plataforma **Orbis**, desenvolvida com Node.js, TypeScript e Express 5.

O projeto utiliza uma arquitetura modular baseada em **Hexagonal Architecture (Ports and Adapters)**, PostgreSQL com Drizzle ORM e pode ser executado localmente ou como uma AWS Lambda integrada ao Amazon API Gateway.

O PostgreSQL é hospedado pela [Neon](https://neon.tech/), enquanto a infraestrutura AWS é gerenciada com Terraform.

## Technology Stack

| Categoria | Tecnologia |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript |
| HTTP Framework | Express 5 |
| Validation | Zod 4 |
| Database | PostgreSQL 18 |
| ORM | Drizzle ORM |
| Database Driver | node-postgres (`pg`) |
| Password Hashing | Argon2id |
| Testing | Vitest, Supertest, Testcontainers |
| Cloud Runtime | AWS Lambda |
| API Gateway | Amazon API Gateway HTTP API |
| Rate Limiting | Amazon DynamoDB |
| Secrets Management | AWS Secrets Manager |
| Infrastructure as Code | Terraform |
| CI/CD | GitHub Actions |
| Cloud Authentication | AWS IAM OIDC |

## Getting Started

### Prerequisites

For local application development:

- Node.js 22 or later
- npm
- GNU Make
- Docker (required for integration tests)
- A PostgreSQL database

The project uses [Neon](https://neon.tech/) for PostgreSQL hosting, but any compatible PostgreSQL instance can be used for local development.

### 1. Clone the repository

```bash
git clone https://github.com/ffakira/orbis.git
cd orbis
```

### 2. Install dependencies

```bash
make install
```

This runs `npm ci` and installs the dependencies defined in `package-lock.json`.

### 3. Configure environment variables

Create your local environment file:

```bash
cp .env.example .env
```

Configure the database connection and Terms of Service version in `.env`:

```dotenv
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require

TERMS_OF_SERVICE_VERSION=1.0
```

Replace the database placeholders with your PostgreSQL connection details.

`TERMS_OF_SERVICE_VERSION` identifies the published Terms of Service version recorded during registration.

For database migrations, `MIGRATION_DATABASE_URL` can optionally be configured to use a separate database connection:

```dotenv
MIGRATION_DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

When omitted, migrations use `DATABASE_URL`.

**Never commit `.env` or place database credentials in source code.**

### 4. Run database migrations

Generate migrations only after intentional database schema changes:

```bash
npm run db:generate
```

Apply existing migrations:

```bash
npm run db:migrate
```

### 5. Start the development server

```bash
make dev
```

The API will be available at:

```text
http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Application health check |
| GET | `/ready` | Database readiness check |
| POST | `/identity/register` | Register a new account |

### Health checks

```bash
curl -i http://localhost:3000/health
```

```bash
curl -i http://localhost:3000/ready
```

`/health` verifies that the application is responding.

`/ready` verifies database connectivity.

### Account registration

```bash
curl -i -X POST http://localhost:3000/identity/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "+15555550100",
    "password": "synthetic-test-password",
    "acceptTerms": true
  }'
```

The request is validated using Zod before the registration use case executes.

## Development

### Available commands

| Command | Description |
|---|---|
| `make` | Display available commands |
| `make install` | Install dependencies |
| `make dev` | Start the development server |
| `make test` | Run the test suite |
| `make build` | Compile TypeScript |
| `make package` | Build the AWS Lambda deployment package |
| `make clean` | Remove generated build artifacts |
| `make health` | Check the deployed API health endpoint |
| `make ready` | Check deployed API and database readiness |
| `make check` | Run both deployed health checks |

Database commands:

| Command | Description |
|---|---|
| `npm run db:generate` | Generate database migrations |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:studio` | Open Drizzle Studio |

### Run tests

```bash
make test
```

Integration tests use Testcontainers to provision disposable PostgreSQL instances. Docker must be running.

Never run automated integration tests against production databases.

### Build

```bash
make build
```

Before submitting changes, run:

```bash
make test
make build
```

## Architecture

Orbis follows **Hexagonal Architecture (Ports and Adapters)**, keeping business rules independent from delivery mechanisms and infrastructure implementations.

The application is organised around business capabilities. Each module owns its domain, application logic and module-specific infrastructure adapters.

The main architectural boundaries are:

- **Bootstrap:** composition roots and dependency wiring.
- **Delivery:** HTTP and other external entry points.
- **Modules:** business capabilities, including Domain, Application and module-owned Infrastructure.
- **Infrastructure:** shared technical capabilities such as database connectivity, secrets and external integrations.

The application uses the same Express instance for local development and AWS Lambda execution.

See [Architecture Documentation](docs/architecture.md) for the architecture diagrams, module structure and registration flow.

## AWS Deployment

Production infrastructure is managed through Terraform and includes:

- Amazon API Gateway HTTP API.
- AWS Lambda running Node.js 22.
- Amazon DynamoDB for registration rate limiting.
- AWS Secrets Manager.
- Parameters and Secrets Lambda Extension.
- Amazon S3 for Terraform remote state.
- CloudWatch Logs.

Production deployments are initiated manually through GitHub Actions using AWS IAM OIDC federation.

The production workflow separates Terraform planning and application, with an approval requirement before applying infrastructure changes.

See [Deployment Documentation](docs/deployment.md) for AWS configuration, Terraform operations, secrets management and production deployment instructions.

## Current Implementation Scope

The current implementation provides the foundation for the Orbis API and the Identity registration flow.

Implemented capabilities include:

- Modular application architecture.
- User registration.
- Email normalization and uniqueness enforcement.
- Argon2id password hashing.
- Server-controlled Terms of Service acceptance.
- Transactional persistence of users, terms acceptance and outbox events.
- PostgreSQL persistence through Drizzle ORM.
- Integration testing with Testcontainers.
- Express HTTP delivery.
- AWS Lambda deployment.
- API Gateway integration.
- DynamoDB registration rate-limiting infrastructure.
- AWS Secrets Manager integration.
- Terraform-managed infrastructure.
- GitHub Actions CI/CD with AWS OIDC.
- Production deployment approval and post-deployment health checks.

The transactional outbox currently guarantees durable event persistence within the business transaction. Background dispatch and external event publishing remain future work.

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment and Infrastructure](docs/deployment.md)

## Licence

No licence has been selected for this repository yet.
