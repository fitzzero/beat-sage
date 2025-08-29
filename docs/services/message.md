# messageService

Source: server/src/services/message/index.ts

## Public Methods

### cancelStream

- Access: Moderate
- Entry-scoped: Yes

#### Payload

```ts
{ chatId: string; }
```

#### Response

```ts
{ cancelled: boolean; }
```

### listMessages

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ chatId: string; before?: string; limit?: number; }
```

#### Response

```ts
import("/Users/root1/Dev/beat-sage/shared/types").ChatThreadMessage[]
```

### postMessage

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ chatId: string; content: string; role?: "user" | "assistant" | "system" | "tool"; }
```

#### Response

```ts
{ id: string; }
```

### streamAssistantMessage

- Access: Moderate
- Entry-scoped: Yes

#### Payload

```ts
{ chatId: string; agentId?: string; modelId?: string; prompt?: string; }
```

#### Response

```ts
{ id: string; }
```

### subscribeChatMessages

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ chatId: string; limit?: number; }
```

#### Response

```ts
import("/Users/root1/Dev/beat-sage/shared/types").ChatThreadMessage[]
```

## Admin Methods

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
