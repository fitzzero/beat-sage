# partyService

Source: server/src/services/party/index.ts

## Public Methods

### createParty

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ hostCharacterId: string; }
```

#### Response

```ts
{ id: string; }
```

### joinParty

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ partyId: string; characterId: string; }
```

#### Response

```ts
{ id: string; }
```

### leaveParty

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ partyId: string; characterId: string; }
```

#### Response

```ts
{ id: string; }
```

### setReady

- Access: Read
- Entry-scoped: No

#### Payload

```ts
{ partyId: string; characterId: string; isReady: boolean; }
```

#### Response

```ts
{ partyId: string; characterId: string; isReady: boolean; }
```

### subscribeWithMembers

- Access: Read
- Entry-scoped: Yes

#### Payload

```ts
{ partyId: string; }
```

#### Response

```ts
PartySnapshot
```
