# Subscription Deduplication Plan

## Problem

Multiple components calling `useCurrentUserSub()` create duplicate:

- Socket listeners on client
- Server subscriptions
- Memory usage

## Solution: Global Subscription Manager

### Architecture

```
GlobalSubscriptionManager
├── subscriptions: Map<key, SharedSubscription>
└── SharedSubscription
    ├── data: T
    ├── subscribers: Set<ComponentInstance>
    ├── socketSubscription: SocketSubscription
    └── refCount: number
```

### Key Principles

1. **Subscription Key**: `${serviceName}:${entryId}` uniquely identifies subscriptions
2. **Reference Counting**: Track how many components are subscribed
3. **Shared State**: All components share the same data and loading states
4. **Single Socket**: One socket subscription per unique key
5. **Cleanup on Zero**: Remove subscription when last component unmounts

### Implementation Strategy

1. **Global Map**: Store shared subscriptions by key
2. **Component Registration**: Each component registers/unregisters with shared subscription
3. **State Broadcasting**: Updates notify all registered components
4. **Automatic Cleanup**: Remove from map when refCount reaches 0

## Benefits

- ✅ Multiple components = One socket subscription
- ✅ Shared memory/state across components
- ✅ Automatic cleanup when all components unmount
- ✅ No duplicate server subscriptions
- ✅ Zero API changes to existing hooks
