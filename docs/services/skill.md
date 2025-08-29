# skillService

Source: server/src/services/skill/index.ts

## Public Methods

### listMySkills

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ characterId: string; }
```

#### Response

```ts
{ name: string; id: string; createdAt: Date; updatedAt: Date; characterId: string; manaCost: number; damage: number; cooldownMs: number; lastCastAt: Date | null; mastery: number; totalCasts: number; priority: number | null; targetPriority: import("/Users/root1/Dev/beat-sage/node_modules/.prisma/client/index").$Enums.TargetPriority; }[]
```

### updateSkill

- Access: Moderate
- Entry-scoped: Yes

#### Payload

```ts
{ id: string; patch: { priority?: number | null; name?: string; manaCost?: number; damage?: number; cooldownMs?: number; }; }
```

#### Response

```ts
{ name: string; id: string; createdAt: Date; updatedAt: Date; characterId: string; manaCost: number; damage: number; cooldownMs: number; lastCastAt: Date | null; mastery: number; totalCasts: number; priority: number | null; targetPriority: import("/Users/root1/Dev/beat-sage/node_modules/.prisma/client/index").$Enums.TargetPriority; } | undefined
```
