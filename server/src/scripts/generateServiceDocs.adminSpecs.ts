export const ADMIN_METHOD_SPECS: Record<
  string,
  { payload: string; response: string; description: string }
> = {
  adminList: {
    payload: `{
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
}`,
    response: `{
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total: number;
}`,
    description: "List entries with pagination, sorting and basic filters.",
  },
  adminGet: {
    payload: `{ id: string }`,
    response: `Record<string, unknown> | undefined`,
    description: "Fetch a single entry by id.",
  },
  adminCreate: {
    payload: `{ data: Partial<Record<string, unknown>> }`,
    response: `Record<string, unknown>`,
    description: "Create a new entry (fields depend on service model).",
  },
  adminUpdate: {
    payload: `{ id: string; data: Partial<Record<string, unknown>> }`,
    response: `Record<string, unknown> | undefined`,
    description: "Update an existing entry (fields depend on service model).",
  },
  adminDelete: {
    payload: `{ id: string }`,
    response: `{ id: string; deleted: true }`,
    description: "Delete an entry by id.",
  },
  adminSetEntryACL: {
    payload: `{ id: string; acl: Array<{ userId: string; level: "Read" | "Moderate" | "Admin" }> }`,
    response: `Record<string, unknown> | undefined`,
    description: "Set per-entry ACL list.",
  },
  adminGetSubscribers: {
    payload: `{ id: string }`,
    response: `{
  id: string;
  subscribers: Array<{ socketId: string; userId?: string }>;
}`,
    description: "Get connected socket subscribers for the entry.",
  },
  adminReemit: {
    payload: `{ id: string }`,
    response: `{ emitted: boolean }`,
    description: "Re-emit the latest entry state to subscribers.",
  },
  adminUnsubscribeAll: {
    payload: `{ id: string }`,
    response: `{ id: string; unsubscribed: number }`,
    description: "Clear and count subscribers for the entry.",
  },
};
