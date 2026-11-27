# Stack rules: Angular

## Structure (by type)

```
app/
├── components/      layout components (header, footer…)
├── pages/           one page per route
├── services/
│   └── api/         one API service per resource
├── models/          interfaces and types
└── shared/          reusable components, pipes, directives
```

- Every folder describes its content. Component roles are free (no enforced smart/dumb split).
- `inject()` only, no constructor injection. [LINT `@angular-eslint/prefer-inject`]
- Functional guards, interceptors and resolvers (`CanActivateFn`, `HttpInterceptorFn`). [LINT]
- `HttpClient` only inside `services/api/*.api.ts`; the API service unwraps the `{ success, data }` envelope; HTTP errors handled by one interceptor. [LINT `no-restricted-imports` outside services/api]
- No `.subscribe()` without `takeUntilDestroyed`. [LINT `rxjs-x/no-ignored-subscription`]

## State decision rule [REVIEW]

1. component-local state → `signal()` / `computed()`
2. state shared across pages → service store built on signals
3. time-based async streams (debounce, websocket, polling, combining, `switchMap` cancellation) → RxJS
4. RxJS → template through `toSignal()`
5. NgRx forbidden unless the ticket explicitly decides it

No Observable for plain synchronous state.

## Tests

- Unit tests for services, stores and pipes (not component rendering).
- Playwright E2E only for critical paths listed in `.loop/config.yml` → `tests.criticalPaths`.
