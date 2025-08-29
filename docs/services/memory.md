# memoryService

Source: server/src/services/memory/index.ts

## Public Methods

### createMemory

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ title?: string; content: string; type?: string; tags?: string[]; associatedIds?: string[]; chatId?: string; agentId?: string; }
```

#### Response

```ts
{ memory: Record<string, unknown>; }
```

### findMemories

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ query: string; filters?: { chatId?: string; agentId?: string; userId?: string; type?: string; tags?: string[]; }; includeAssociationsDepth?: number; limit?: number; offset?: number; }
```

#### Response

```ts
{ results: import("/Users/root1/Dev/beat-sage/shared/types").MemoryDTO[]; }
```

### getMemory

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; includeAssociationsDepth?: number; }
```

#### Response

```ts
{ memory?: import("/Users/root1/Dev/beat-sage/shared/types").MemoryDTO; }
```

### linkMemories

- Access: Moderate
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; associate: string[]; bidirectional?: boolean; }
```

#### Response

```ts
{ id: string; associatedIds: string[]; }
```

### summarizeChatIfNeeded

- Access: Moderate
- Entry-scoped: No

#### Payload

```ts
{ chatId: string; }
```

#### Response

```ts
{ created: boolean; memory?: import("/Users/root1/Dev/beat-sage/shared/types").MemoryDTO; }
```

### unlinkMemories

- Access: Moderate
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; remove: string[]; bidirectional?: boolean; }
```

#### Response

```ts
{ id: string; associatedIds: string[]; }
```

### updateMemory

- Access: Moderate
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; patch: Partial<{ title: string; content: string; type: string; tags: string[]; associatedIds: string[]; pinned: boolean; importance: number; acl: Array<{ userId: string; level: "Read" | "Moderate" | "Admin"; }>; }>; }
```

#### Response

```ts
{ memory?: import("/Users/root1/Dev/beat-sage/shared/types").MemoryDTO; }
```

## Admin Methods

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
