const longBody = Array.from({ length: 32 }, (_, i) => `  const step${String(i)} = input;`).join('\n');

export const expressCases = [
  { name: 'clean service passes', file: 'src/services/expense.service.ts', expect: [], code:
`import { findExpense } from '../repositories/expense.repository';

const MAX_AMOUNT = 1000;

export const isAllowed = (amount: number): boolean => amount <= MAX_AMOUNT;

export const loadExpense = (id: string): string => findExpense(id);
` },
  { name: 'repository', file: 'src/repositories/expense.repository.ts', expect: [], code:
`export const findExpense = (id: string): string => id;
` },
  { name: 'class is forbidden', file: 'src/utils/money.ts', expect: ['no-restricted-syntax'], code:
`export class Money {
  readonly value: string = '';
}
` },
  { name: 'switch with 3 cases is forbidden', file: 'src/utils/label.ts', expect: ['no-restricted-syntax'], code:
`export const label = (kind: 'a' | 'b' | 'c'): string => {
  switch (kind) {
    case 'a': return 'A';
    case 'b': return 'B';
    case 'c': return 'C';
  }
};
` },
  { name: 'let is forbidden', file: 'src/utils/counter.ts', expect: ['functional/no-let'], code:
`export const count = (items: readonly string[]): number => {
  let total = 0;
  items.forEach(() => { total += 1; });
  return total;
};
` },
  { name: 'mutation is forbidden', file: 'src/utils/append.ts', expect: ['functional/immutable-data'], code:
`export const append = (items: string[], item: string): string[] => {
  items.push(item);
  return items;
};
` },
  { name: 'function over 30 lines is forbidden', file: 'src/utils/long.ts', expect: ['max-lines-per-function'], code:
`export const long = (input: string): string => {
${longBody}
  return step0 + step1;
};
` },
  { name: 'magic number is forbidden', file: 'src/utils/vat.ts', expect: ['@typescript-eslint/no-magic-numbers'], code:
`export const withVat = (amount: number): number => amount * 1.2;
` },
  { name: 'any is forbidden', file: 'src/utils/raw.ts', expect: ['@typescript-eslint/no-explicit-any'], code:
`export const raw = (value: any): string => String(value);
` },
  { name: 'exported function needs a return type', file: 'src/utils/implicit.ts', expect: ['@typescript-eslint/explicit-module-boundary-types'], code:
`export const implicit = (value: string) => value.trim();
` },
  { name: 'file name must be kebab-case', file: 'src/utils/badName.ts', expect: ['unicorn/filename-case'], code:
`export const ok = (): boolean => true;
` },
  { name: 'snake_case identifier is forbidden', file: 'src/utils/snake.ts', expect: ['@typescript-eslint/naming-convention'], code:
`export const total_amount = (): number => 0;
` },
  { name: 'emoji is forbidden', file: 'src/utils/greeting.ts', expect: ['loop/no-emoji'], code:
`export const greeting = (): string => 'Done \u{1F680}';
` },
  { name: 'todo without issue is forbidden', file: 'src/utils/todo.ts', expect: ['loop/todo-requires-issue'], code:
`// TODO handle refunds
export const refund = (): boolean => false;
` },
  { name: 'todo with issue passes', file: 'src/utils/todo-ok.ts', expect: [], code:
`// TODO(#42): handle refunds
export const refund = (): boolean => false;
` },
  { name: 'controller cannot import a repository', file: 'src/controllers/expense.controller.ts', expect: ['import-x/no-restricted-paths'], code:
`import { findExpense } from '../repositories/expense.repository';

export const show = (id: string): string => findExpense(id);
` },
  { name: 'service cannot import mongoose', file: 'src/services/raw.service.ts', expect: ['no-restricted-imports'], code:
`import 'mongoose';

export const ping = (): boolean => true;
` },
];

export const angularCases = [
  { name: 'decorated component with inject passes', file: 'src/app/pages/home/home.page.ts', expect: [], code:
`import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({ selector: 'app-home', template: '<p>Home</p>' })
export class HomePage {
  private readonly router = inject(Router);

  open(): Promise<boolean> {
    return this.router.navigate(['/']);
  }
}
` },
  { name: 'api service may use HttpClient', file: 'src/app/services/api/trips.api.ts', expect: [], code:
`import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TripsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<readonly string[]> {
    return this.http.get<readonly string[]>('/trips');
  }
}
` },
  { name: 'undecorated class is forbidden', file: 'src/app/models/trip.ts', expect: ['no-restricted-syntax'], code:
`export class Trip {
  readonly id: string = '';
}
` },
  { name: 'constructor injection is forbidden', file: 'src/app/pages/about/about.page.ts', expect: ['@angular-eslint/prefer-inject'], code:
`import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({ selector: 'app-about', template: '<p>About</p>' })
export class AboutPage {
  constructor(private readonly router: Router) {}

  open(): Promise<boolean> {
    return this.router.navigate(['/']);
  }
}
` },
  { name: 'HttpClient outside services/api is forbidden', file: 'src/app/pages/list/list.page.ts', expect: ['no-restricted-imports'], code:
`import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({ selector: 'app-list', template: '<p>List</p>' })
export class ListPage {
  readonly http = inject(HttpClient);
}
` },
  { name: 'class-based guard is forbidden', file: 'src/app/guards/auth.guard.ts', expect: ['no-restricted-syntax'], code:
`import { Injectable } from '@angular/core';
import type { CanActivate } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
` },
  { name: 'ignored subscription is forbidden', file: 'src/app/pages/live/live.page.ts', expect: ['rxjs-x/no-ignored-subscription'], code:
`import { Component } from '@angular/core';
import { interval } from 'rxjs';

const TICK_MS = 1000;

@Component({ selector: 'app-live', template: '<p>Live</p>' })
export class LivePage {
  start(): void {
    interval(TICK_MS).subscribe();
  }
}
` },
];
