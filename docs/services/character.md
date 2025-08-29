# characterService

Source: server/src/services/character/index.ts

## Public Methods

### createCharacter

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ name: string; }
```

#### Response

```ts
{ id: string; }
```

### listMine

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ page?: number; pageSize?: number; }
```

#### Response

```ts
{ name: string; id: string; createdAt: Date; updatedAt: Date; userId: string; online: boolean; }[]
```

### updateCharacter

- Access: Moderate
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; patch: { name?: string; online?: boolean; }; }
```

#### Response

```ts
{ name: string; id: string; createdAt: Date; updatedAt: Date; userId: string; online: boolean; } | undefined
```
