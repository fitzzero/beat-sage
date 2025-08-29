# locationService

Source: server/src/services/location/index.ts

## Public Methods

### listLocations

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ page?: number; pageSize?: number; }
```

#### Response

```ts
Pick<{ name: string; id: string; coordinates: string | null; image: string | null; difficulty: number; }, "name" | "id" | "difficulty">[]
```
