# Stack rules: MongoDB + Mongoose

- Entity types come from the Mongoose schema (`InferSchemaType`); Zod only describes input payloads (Create / Update).
- Relations decision rule: [REVIEW]
  1. standalone entity → ObjectId reference (+ targeted populate)
  2. owned, bounded sub-object → embedding
  3. value frozen in time (price at sale time, product info on an invoice) → embedded snapshot + reference
  4. unbounded array → separate collection, never embedded
- Dates are always `Date`, never `String`. [REVIEW]
- Every list route is paginated: no `find()` without `limit`. [REVIEW + integration test]
- Reads use `.lean()`. [REVIEW]
- Every filtered or sorted field has an index declared in the schema. [REVIEW]
- Money is `Decimal128`; conversion and formatting live in `utils/money.ts` only. [REVIEW]
- Any change in `models/` is sensitive → PR. [PR]
- `docs/data-model.md` updated in the same PR as any schema or index change. [REVIEW]
