# Diagram Generation Guide

Mermaid diagram conventions and PNG rendering for specification documents.

---

## Overview

Specifications benefit from visual diagrams to clarify architecture, data flows, interactions, and relationships. This guide covers:
- Mermaid diagram types (flowchart, sequence, class, ER)
- When to use each type
- Mermaid syntax essentials
- PNG rendering via mermaid-cli (mmdc) availability check
- Fallback strategy when mmdc is unavailable

---

## Diagram Types & When to Use

### Flowchart (Process Flow)
**Use for:** Sequential processes, decision logic, data flow start-to-end, system workflows

**Example: Data flow for a checkout process**
```mermaid
flowchart TD
  Start[User initiates checkout] --> Cart[Retrieve shopping cart]
  Cart --> Validate{Cart valid?}
  Validate -->|No| Error[Return error]
  Validate -->|Yes| Payment[Initiate payment]
  Payment --> Process{Payment OK?}
  Process -->|No| PaymentError[Return payment error]
  Process -->|Yes| Confirm[Confirm order]
  Confirm --> Email[Send confirmation email]
  Email --> End[Checkout complete]
  Error --> End
  PaymentError --> End
```

**Mermaid syntax:**
- `flowchart TD` — Top-down direction (or `LR` for left-right)
- `[rectangle]` — Process/action
- `{diamond}` — Decision (yes/no)
- `(rounded)` — Start/end
- `-->` — Flow arrow
- `-->|Label|` — Labeled arrow

### Sequence Diagram
**Use for:** Multi-actor interactions, API request/response, protocol flows, authentication sequences

**Example: API authentication flow**
```mermaid
sequenceDiagram
  Client->>Auth: POST /login (user, pass)
  Auth->>DB: Query user by email
  DB-->>Auth: User record
  Auth->>Auth: Hash password, compare
  alt Password matches
    Auth->>JWT: Generate token
    JWT-->>Auth: Token
    Auth-->>Client: 200 OK (token)
  else Password invalid
    Auth-->>Client: 401 Unauthorized
  end
```

**Mermaid syntax:**
- `sequenceDiagram` — Opens diagram
- `Actor->>Actor: Message` — Synchronous call
- `Actor-->>Actor: Response` — Return/async
- `alt / else` — Conditional blocks
- `par` — Parallel calls
- `loop` — Repeated calls

### Class Diagram
**Use for:** Object-oriented design, domain models, type hierarchies, relationships between entities

**Example: E-commerce domain model**
```mermaid
classDiagram
  class User {
    id: UUID
    email: string
    password_hash: string
    created_at: timestamp
    authenticate(password)
  }
  class Order {
    id: UUID
    user_id: UUID
    total: decimal
    status: OrderStatus
    created_at: timestamp
    calculate_total()
  }
  class LineItem {
    order_id: UUID
    product_id: UUID
    quantity: int
    price: decimal
  }
  class Product {
    id: UUID
    name: string
    price: decimal
    in_stock: bool
  }

  User "1" --> "*" Order : places
  Order "1" --> "*" LineItem : contains
  LineItem "1" --> "1" Product : references
```

**Mermaid syntax:**
- `class ClassName { attributes methods }` — Class definition
- `Class1 "cardinality" --> "cardinality" Class2 : relationship` — Associations
- `-|>` — Inheritance
- `--` — Association

### ER Diagram (Entity-Relationship)
**Use for:** Database schema, data relationships, cardinality, normalization

**Example: Order management schema**
```mermaid
erDiagram
  USER ||--o{ ORDER : places
  USER {
    uuid id PK
    string email UK
    string password_hash
    timestamp created_at
  }
  ORDER ||--|{ LINEITEM : contains
  ORDER {
    uuid id PK
    uuid user_id FK
    decimal total
    enum status
    timestamp created_at
  }
  LINEITEM ||--|| PRODUCT : references
  LINEITEM {
    uuid order_id FK
    uuid product_id FK
    int quantity
    decimal price
  }
  PRODUCT {
    uuid id PK
    string name
    decimal price
    bool in_stock
  }
```

**Mermaid syntax:**
- `entity || relationship {} : label` — Entity with relationship
- `PK` — Primary key
- `FK` — Foreign key
- `UK` — Unique key
- `||--o{` — One-to-many (cardinality)
- `||--||` — One-to-one

---

## Mermaid Syntax Essentials

### Common Patterns

**Naming & identifiers:**
- Use PascalCase for entity/class/actor names
- Use snake_case for attributes/fields
- Keep labels concise (max 40 chars per node)

**Coloring (optional):**
```mermaid
flowchart TD
  A[Action]:::success --> B[Result]:::info
  classDef success fill:#90EE90
  classDef info fill:#87CEEB
```

**Subgraphs (grouping):**
```mermaid
flowchart TD
  subgraph Frontend["Frontend (React)"]
    A[Auth Component]
    B[Dashboard]
  end
  subgraph Backend["Backend (Node.js)"]
    C[Auth Service]
    D[Data Service]
  end
  A --> C
  B --> D
```

---

## PNG Rendering

### Availability Check

Before rendering Mermaid source to PNG, check for mermaid-cli availability:

**Step 1: ToolSearch for Playwright MCP**

Use `ToolSearch` with query `"select:mermaid"` or similar to check if a Mermaid MCP is available.

**Step 2: CLI Fallback**

If no MCP, check for local CLI:
```bash
which mmdc
# or on Windows:
where mmdc
```

**Step 3: Render if Available**

If `mmdc` is found:
```bash
mmdc -i input.mmd -o output.png
```

**Step 4: Embed in Spec**

- If PNG generated: `![Architecture Diagram](spec-feature-architecture.png)` (relative path)
- If unavailable: Embed Mermaid source and note the requirement

### Fallback Message

If `mmdc` is not installed, embed the message:

```markdown
**Note:** PNG rendering requires mermaid-cli. To generate:

```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i diagram.mmd -o diagram.png
```

Or use [Mermaid Live Editor](https://mermaid.live) to render online.
```

---

## When to Add Diagrams to Specs

### Required Diagrams
- **Architecture spec:** Data-flow flowchart (start to end)
- **API endpoint spec:** Sequence diagram (request/response with auth if applicable)

### Optional but Recommended
- **Functionality spec:** Flowchart for complex business logic
- **UI/UX design spec:** Class diagram for state/interaction model
- **General spec:** Whenever behavior is clarified by a visual

### When NOT to Add Diagrams
- Simple CRUD operations (sufficient in text)
- Trivial data models (< 3 entities)
- High-level overviews already covered elsewhere

---

## Embedding Diagrams in Markdown

### Direct Mermaid Syntax (Most Platforms)

````markdown
## Architecture

```mermaid
flowchart TD
  Client[Client] --> API[API Gateway]
  API --> Service[Service]
  Service --> DB[Database]
```
````

### Markdown with Image Reference

```markdown
## Architecture

![Architecture Diagram](spec-feature-architecture.png)

*Generated from: [diagram.mmd](diagram.mmd)*
```

### Fallback with Source Code

```markdown
## Data Flow

```mermaid
flowchart TD
  ...
```

**Or render the above as PNG:**
```
mmdc -i flow.mmd -o flow.png
```
```

---

## Best Practices

1. **Keep diagrams simple:** 5-15 nodes max; split into multiple diagrams if needed
2. **Use consistent naming:** Entity names match schema/code, attribute names match API contracts
3. **Label relationships:** Every arrow should have a label (except in flowcharts where flow direction is obvious)
4. **Directional consistency:** Left-to-right (LR) or top-down (TD) per context; don't mix in one diagram
5. **Color sparingly:** Use color to highlight critical paths or layers, not for decoration
6. **Cardinality clarity:** ER diagrams MUST show 1:1, 1:N, N:M relationships explicitly

---

## Examples in Specs

### Architecture Spec Data Flow
```mermaid
flowchart TD
  Request[HTTP Request] --> LB[Load Balancer]
  LB --> Web1[Web Server 1]
  LB --> Web2[Web Server 2]
  Web1 --> Cache[Redis Cache]
  Web2 --> Cache
  Cache --> DB[(PostgreSQL)]
  DB --> Replica[(Replica DB)]
  Web1 --> Queue[Message Queue]
  Web2 --> Queue
  Queue --> Worker[Background Worker]
```

### API Endpoint Spec Sequence
```mermaid
sequenceDiagram
  Client->>API: POST /api/orders
  API->>Auth: Validate JWT
  Auth-->>API: User context
  API->>Inventory: Check stock
  Inventory-->>API: Available
  API->>Payment: Process payment
  Payment-->>API: Success
  API->>DB: Insert order
  DB-->>API: Order ID
  API-->>Client: 201 Created
```

---

## Troubleshooting

**Mermaid diagram not rendering:**
- Check syntax for typos (flowchart vs flow, etc.)
- Validate at [mermaid.live](https://mermaid.live)
- Ensure no circular references (in ER diagrams)

**mmdc command not found:**
- Install: `npm install -g @mermaid-js/mermaid-cli`
- Check PATH: `echo $PATH`
- On Windows, may need to restart shell after install

**PNG file too large:**
- Simplify diagram (fewer nodes)
- Use `--width` and `--height` flags: `mmdc -i input.mmd -o output.png --width 1200 --height 800`
