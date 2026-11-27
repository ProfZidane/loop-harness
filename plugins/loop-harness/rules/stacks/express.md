# Stack rules: Node.js + Express + TypeScript

## Structure (by layer)

```
src/
├── routes/          route definitions + middlewares
├── controllers/     HTTP only (req → service → res)
├── services/        business logic, returns Result
├── repositories/    the ONLY place that talks to the database driver/ODM
├── models/          database schemas (source of truth for entity types)
├── validators/      Zod schemas for input payloads
├── middlewares/     auth, validate, error, rate-limit
├── errors/          error factories (notFound, forbidden, conflict…)
├── utils/
├── config/
└── app.ts
```

- Flow: route → `validate(zod)` → controller → service → repository → ODM. [LINT `import/no-restricted-paths`: controllers cannot import repositories/models; services cannot import the ODM]
- Controller: no try/catch, no business logic; turns the `Result` into HTTP through one shared helper. [REVIEW]
- Validation: Zod middleware on the route; input types via `z.infer`. Default Zod mode (strips unknown keys), not `.strict()` everywhere; handlers read only the parsed output. [REVIEW]

## Response format

- Real HTTP status codes.
- Success: `{ success: true, message, data, meta? }` (`meta` for pagination).
- Error: `{ success: false, message, error: { code: "SCREAMING_SNAKE", details? } }`.
- Unexpected errors → generic 500 + log, never a stack trace in the response. [CI integration test on format]

## Security

- `helmet`, explicit CORS allowlist, rate limit on login / register / forgot-password. [REVIEW + test]
- Auth token depends on the deployment (`.loop/config.yml` → `security.authTransport`):
  - front and API under one registrable domain (`app.x.com` + `api.x.com`) → httpOnly + SameSite cookie, short access token + refresh token
  - different domains → Bearer, short access token, strict CSP
- Access control on routes that need it, checked by the security reviewer. [REVIEW]

## Tests

- Service unit tests with repositories mocked (Vitest).
- API integration tests: supertest + in-memory database, one per route: status, envelope, access control.
