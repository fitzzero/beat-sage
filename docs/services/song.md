# songService

Source: server/src/services/song/index.ts

## Public Methods

### getSongBeats

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ songId: string; }
```

#### Response

```ts
Pick<{ id: string; songId: string; index: number; timeMs: number; direction: import("/Users/root1/Dev/beat-sage/node_modules/.prisma/client/index").$Enums.Direction; holdMs: number; }, "index" | "timeMs" | "direction" | "holdMs">[]
```

### listSongs

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ genreId?: string; page?: number; pageSize?: number; }
```

#### Response

```ts
Pick<{ name: string; id: string; createdAt: Date; updatedAt: Date; genreId: string; src: string; }, "name" | "id" | "genreId">[]
```
