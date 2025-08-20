# chatService

Source: server/src/services/chat/index.ts

## Admin Methods

### adminCreate

- Access: Read
- Description: Create a new entry (fields depend on service model).

#### Payload

```ts
{ data: Partial<Record<string, unknown>> }
```

#### Response

```ts
Record<string, unknown>
```

### adminDelete

- Access: Admin
- Description: Delete an entry by id.

#### Payload

```ts
{ id: string }
```

#### Response

```ts
{ id: string; deleted: true }
```

### adminGet

- Access: Moderate
- Description: Fetch a single entry by id.

#### Payload

```ts
{ id: string }
```

#### Response

```ts
Record<string, unknown> | undefined
```

### adminGetSubscribers

- Access: Admin
- Description: Get connected socket subscribers for the entry.

#### Payload

```ts
{ id: string }
```

#### Response

```ts
{
  id: string;
  subscribers: Array<{ socketId: string; userId?: string }>;
}
```

### adminList

- Access: Moderate
- Description: List entries with pagination, sorting and basic filters.

#### Payload

```ts
{
  page?: number;
  pageSize?: number;
  sort?: { field?: string; direction?: "asc" | "desc" };
  filter?: {
    id?: string;
    ids?: string[];
    createdAfter?: string;
    createdBefore?: string;
    updatedAfter?: string;
    updatedBefore?: string;
  };
}
```

#### Response

```ts
{
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
}
```

### adminReemit

- Access: Admin
- Description: Re-emit the latest entry state to subscribers.

#### Payload

```ts
{ id: string }
```

#### Response

```ts
{ emitted: boolean }
```

### adminUnsubscribeAll

- Access: Admin
- Description: Clear and count subscribers for the entry.

#### Payload

```ts
{ id: string }
```

#### Response

```ts
{ id: string; unsubscribed: number }
```

### adminUpdate

- Access: Moderate
- Description: Update an existing entry (fields depend on service model).

#### Payload

```ts
{ id: string; data: Partial<Record<string, unknown>> }
```

#### Response

```ts
Record<string, unknown> | undefined
```
