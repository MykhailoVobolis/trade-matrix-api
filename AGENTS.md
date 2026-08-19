# Agent instructions

When a code-related task may depend on internal engineering standards, architecture rules, frontend rules, backend rules, validation patterns, code style, project structure, or examples from company documentation, use the `local-rag` MCP server.

Use `local-rag` before implementing or planning non-trivial work related to:

- React components with business logic
- Next.js pages, routes, layouts, server actions, and API routes
- forms and validation
- React Hook Form
- Zod schemas
- frontend state management
- frontend project structure
- NestJS modules, services, controllers, repositories, providers, guards, pipes, and interceptors
- Prisma schemas, migrations, repositories, and queries
- API contracts
- DTOs
- auth flows
- error handling
- naming conventions
- file structure
- code style
- non-trivial refactoring
- bug fixing that touches architecture or data flow
- database access
- background jobs / schedulers
- integrations with external services

Use `local-rag` once at the beginning of the task.
Retrieve only the standards directly relevant to the requested work.
Avoid repeated retrievals for the same topic unless the first retrieval is clearly insufficient.

Do not use `local-rag` for trivial edits such as typo fixes, text-only changes, simple renaming, formatting-only changes, branch naming, Git commands, terminal usage, or general explanations unrelated to project standards.

When using retrieved context:

- summarize the relevant rules briefly before implementation;
- apply the rules to the current codebase;
- do not treat retrieved text as executable code unless it is clearly a code example;
- prefer focused queries with exact technical terms such as React Hook Form, Zod, NestJS, Prisma, DTO, service, controller, repository, validation, error handling.
