import { layeredSearch } from "../../services/memory/middleware/search";

jest.mock("../../services/memory/middleware/llm", () => ({
  // eslint-disable-next-line @typescript-eslint/require-await
  expandQueryTerms: jest.fn(async (q: string) => {
    if (q.toLowerCase() === "fruit") return ["banana", "apple", "plantain"];
    if (q.toLowerCase() === "bread") return ["banana", "loaf"];
    return [];
  }),
}));

type Row = Record<string, unknown> & {
  id: string;
  content: string;
  title?: string;
  updatedAt?: Date | string;
};

const DATASET: Row[] = [
  {
    id: "1",
    content: "apple pie",
    title: "Dessert",
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "2",
    content: "banana bread",
    title: "Recipe",
    updatedAt: new Date("2024-02-01T00:00:00Z"),
  },
  {
    id: "3",
    content: "plantain chips",
    title: "Snack",
    updatedAt: new Date("2024-03-01T00:00:00Z"),
  },
];

function makeFindMany(rows: Row[]) {
  return function findMany(args: {
    where?: Record<string, unknown>;
    take?: number;
    orderBy?: Record<string, "asc" | "desc">;
  }): Promise<Row[]> {
    const where = args.where || {};
    const ors = (where as { OR?: Array<Record<string, unknown>> }).OR || [];
    let results: Row[] = [];
    if (ors.length === 0) {
      // No OR: return empty to keep test simple
      results = [];
    } else {
      const terms: string[] = [];
      for (const cond of ors) {
        const contentCond = (
          cond as { content?: { contains?: string; mode?: string } }
        ).content;
        const titleCond = (
          cond as { title?: { contains?: string; mode?: string } }
        ).title;
        if (contentCond?.contains) terms.push(String(contentCond.contains));
        if (titleCond?.contains) terms.push(String(titleCond.contains));
      }
      const lower = terms.map((t) => t.toLowerCase());
      results = rows.filter((r) => {
        const c = r.content.toLowerCase();
        const t = (r.title || "").toLowerCase();
        return lower.some((term) => c.includes(term) || t.includes(term));
      });
    }
    // order by updatedAt desc
    results.sort((a, b) => {
      const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bd - ad;
    });
    const out = args.take ? results.slice(0, args.take) : results;
    return Promise.resolve(out);
  };
}

describe("layeredSearch (unit)", () => {
  it("uses LLM expansion when lexical has no matches", async () => {
    const findMany = makeFindMany(DATASET);
    const results = await layeredSearch(
      { query: "fruit", limit: 10 },
      findMany
    );
    const ids = (results as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual(["3", "2", "1"]); // ordered by updatedAt desc
  });

  it("merges lexical and LLM-expanded results without duplicates", async () => {
    const findMany = makeFindMany(DATASET);
    const results = await layeredSearch(
      { query: "bread", limit: 10 },
      findMany
    );
    const ids = (results as Array<{ id: string }>).map((r) => r.id);
    // lexical("bread") returns id=2; LLM adds banana (2 again) and loaf (none)
    expect(ids).toEqual(["2"]);
  });
});
