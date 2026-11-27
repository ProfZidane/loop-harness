# Data model

## Entities

```mermaid
classDiagram
  direction LR
  class Market {
    ObjectId _id
    string name
    Date createdAt
  }
  class Product {
    ObjectId _id
    ObjectId marketId
    string name
    Decimal128 price
  }
  class Sale {
    ObjectId _id
    ObjectId marketId
    SaleLine[] lines
    Decimal128 total
    Date soldAt
  }
  class SaleLine {
    ObjectId productId
    ProductSnapshot product
    int quantity
    Decimal128 unitPrice
  }
  Market "1" --> "*" Product : reference
  Market "1" --> "*" Sale : reference
  Sale "1" *-- "1..*" SaleLine : embedded
  SaleLine --> Product : reference + snapshot
```

Notes:
- `SaleLine.product` is a snapshot: price and name frozen at sale time.
- Unbounded histories live in their own collection, never embedded.

## Physical

| Collection | Indexes | Shard key | Retention |
|---|---|---|---|
| sales | `{ marketId: 1, soldAt: -1 }` | none | forever |

## Cross-database links

<!-- other databases, caches, search indexes, and how they stay in sync -->
