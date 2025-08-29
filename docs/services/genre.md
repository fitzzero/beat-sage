# genreService

Source: server/src/services/genre/index.ts

## Public Methods

### listAll

- Access: Read
- Entry-scoped: No

#### Payload

```ts
Record<string, never>
```

#### Response

```ts
Pick<{ name: string; id: string; description: string | null; }, "name" | "id" | "description">[]
```
