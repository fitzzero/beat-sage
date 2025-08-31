# instanceService

Source: server/src/services/instance/index.ts

## Public Methods

### attemptBeat

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; characterId: string; clientBeatTimeMs: number; }
```

#### Response

```ts
{ grade: "Perfect" | "Great" | "Good" | "Bad" | "Miss"; manaDelta: number; rateDelta: number; }
```

### createInstance

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ partyId: string; locationId: string; songId: string; }
```

#### Response

```ts
{ id: string; status: PrismaInstance["status"]; }
```

### restartInstance

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; }
```

#### Response

```ts
{ id: string; status: PrismaInstance["status"]; startedAt?: Date | null; }
```

### startInstance

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; }
```

#### Response

```ts
{ id: string; status: PrismaInstance["status"]; startedAt?: Date | null; }
```

### updateSettings

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; songId?: string; locationId?: string; }
```

#### Response

```ts
{ id: string; songId?: string; locationId?: string; }
```
