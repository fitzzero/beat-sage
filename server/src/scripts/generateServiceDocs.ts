import fs from "fs";
import path from "path";
import ts from "typescript";

// Paths
// Determine paths relative to the workspace the script is executed from.
// This script is run via the server workspace (cwd = <repo>/server).
const SERVER_WORKSPACE_ROOT = path.resolve(process.cwd());
const MONOREPO_ROOT = path.resolve(SERVER_WORKSPACE_ROOT, "..");
const SERVER_SRC = path.join(SERVER_WORKSPACE_ROOT, "src");
const SERVICES_DIR = path.join(SERVER_SRC, "services");
const OUTPUT_DIR = path.join(MONOREPO_ROOT, "docs", "services");

// Admin method specs inferred from BaseService.installAdminMethods
const ADMIN_METHOD_SPECS: Record<
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

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanOutputDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".md")) fs.unlinkSync(path.join(dir, f));
  }
}

function getServiceFolders(): string[] {
  if (!fs.existsSync(SERVICES_DIR)) return [];
  return fs
    .readdirSync(SERVICES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(SERVICES_DIR, d.name))
    .filter((dir) => fs.existsSync(path.join(dir, "index.ts")));
}

function createProgram(filePaths: string[]): ts.Program {
  return ts.createProgram(filePaths, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    baseUrl: SERVER_SRC,
  });
}

type PublicMethodDoc = {
  name: string;
  access: string;
  payloadType: string;
  responseType: string;
  entryScoped: boolean;
  description?: string;
};

type AdminMethodDoc = {
  name: string;
  access: string;
  enabled: boolean;
};

type ServiceDoc = {
  serviceName: string;
  filePath: string;
  publicMethods: PublicMethodDoc[];
  adminMethods: AdminMethodDoc[];
};

function extractJSDoc(
  node: ts.Node,
  sourceFile: ts.SourceFile
): string | undefined {
  const jsDocs = ts.getJSDocCommentsAndTags(node);
  const texts: string[] = [];
  for (const d of jsDocs) {
    const full = d.getText(sourceFile);
    // Strip comment markers
    const cleaned = full
      .replace(/^\/\*\*?/g, "")
      .replace(/\*\/$/g, "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter((l) => !!l)
      .join(" ");
    if (cleaned) texts.push(cleaned);
  }
  return texts.length ? texts.join(" ") : undefined;
}

function isDefinePublicMethodCall(
  expr: ts.Expression
): expr is ts.CallExpression {
  if (!ts.isCallExpression(expr)) return false;
  const callee = expr.expression;
  return (
    ts.isPropertyAccessExpression(callee) &&
    callee.expression.kind === ts.SyntaxKind.ThisKeyword &&
    callee.name.text === "definePublicMethod"
  );
}

function parseServiceFile(
  serviceIndexPath: string,
  program: ts.Program
): ServiceDoc | null {
  const source = program.getSourceFile(serviceIndexPath);
  if (!source) return null;

  const serviceNameFromPath = path.basename(path.dirname(serviceIndexPath));

  // TypeChecker available if needed in future
  void program.getTypeChecker();

  const publicMethods: PublicMethodDoc[] = [];
  const adminMethods: AdminMethodDoc[] = [];
  let serviceName = serviceNameFromPath;

  function extractText(node: ts.Node): string {
    return node.getText(source as ts.SourceFile);
  }

  function visit(node: ts.Node) {
    // Find constructor super call to get serviceName string if present
    if (ts.isCallExpression(node)) {
      const callExpr = node;
      if (
        ts.isPropertyAccessExpression(callExpr.expression) &&
        callExpr.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
        callExpr.expression.name.text === "installAdminMethods"
      ) {
        const arg = callExpr.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          const exposeProp = arg.properties.find(
            (p): p is ts.PropertyAssignment =>
              ts.isPropertyAssignment(p) &&
              ts.isIdentifier(p.name) &&
              p.name.text === "expose"
          );
          const accessProp = arg.properties.find(
            (p): p is ts.PropertyAssignment =>
              ts.isPropertyAssignment(p) &&
              ts.isIdentifier(p.name) &&
              p.name.text === "access"
          );
          const expose: Record<string, boolean> = {};
          const access: Record<string, string> = {};
          if (
            exposeProp &&
            ts.isObjectLiteralExpression(exposeProp.initializer)
          ) {
            for (const p of exposeProp.initializer.properties) {
              if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                const key = p.name.text;
                const val = p.initializer;
                if (val.kind === ts.SyntaxKind.TrueKeyword) expose[key] = true;
                if (val.kind === ts.SyntaxKind.FalseKeyword)
                  expose[key] = false;
              }
            }
          }
          if (
            accessProp &&
            ts.isObjectLiteralExpression(accessProp.initializer)
          ) {
            for (const p of accessProp.initializer.properties) {
              if (
                ts.isPropertyAssignment(p) &&
                ts.isIdentifier(p.name) &&
                ts.isStringLiteralLike(p.initializer)
              ) {
                access[p.name.text] = p.initializer.text;
              }
            }
          }
          // Map exposes to admin method names
          const mapping: Record<string, string> = {
            list: "adminList",
            get: "adminGet",
            create: "adminCreate",
            update: "adminUpdate",
            delete: "adminDelete",
            setEntryACL: "adminSetEntryACL",
            getSubscribers: "adminGetSubscribers",
            reemit: "adminReemit",
            unsubscribeAll: "adminUnsubscribeAll",
          };
          for (const k of Object.keys(mapping)) {
            const enabled = !!expose[k];
            const methodName = mapping[k];
            const level = access[k] || "";
            adminMethods.push({ name: methodName, access: level, enabled });
          }
        }
      }

      // Look for super({ serviceName: "..." })
      if (
        callExpr.expression.kind === ts.SyntaxKind.SuperKeyword &&
        callExpr.arguments.length === 1 &&
        ts.isObjectLiteralExpression(callExpr.arguments[0])
      ) {
        const obj = callExpr.arguments[0];
        const svcNameProp = obj.properties.find(
          (p): p is ts.PropertyAssignment =>
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === "serviceName"
        );
        if (svcNameProp && ts.isStringLiteralLike(svcNameProp.initializer)) {
          serviceName = svcNameProp.initializer.text;
        }
      }
    }

    // Collect public methods declared as class field initializers
    if (
      ts.isPropertyDeclaration(node) &&
      node.initializer &&
      isDefinePublicMethodCall(node.initializer)
    ) {
      const callExpr = node.initializer;
      const typeArgs = callExpr.typeArguments || [];
      const payloadType = typeArgs[0] ? extractText(typeArgs[0]) : "unknown";
      const responseType = typeArgs[1] ? extractText(typeArgs[1]) : "unknown";

      const args = callExpr.arguments;
      const nameArg = args[0];
      const accessArg = args[1];
      let methodName = "";
      let access = "";
      if (nameArg && ts.isStringLiteralLike(nameArg)) methodName = nameArg.text;
      if (accessArg && ts.isStringLiteralLike(accessArg))
        access = accessArg.text;

      // options arg may contain resolveEntryId
      let entryScoped = false;
      if (args.length >= 4 && ts.isObjectLiteralExpression(args[3])) {
        entryScoped = args[3].properties.some(
          (p) =>
            ts.isPropertyAssignment(p) &&
            ts.isIdentifier(p.name) &&
            p.name.text === "resolveEntryId"
        );
      }

      const description = extractJSDoc(node, source as ts.SourceFile);

      publicMethods.push({
        name: methodName,
        access,
        payloadType,
        responseType,
        entryScoped,
        description: description || undefined,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  // Sort methods by name
  publicMethods.sort((a, b) => a.name.localeCompare(b.name));
  adminMethods.sort((a, b) => a.name.localeCompare(b.name));

  return {
    serviceName,
    filePath: serviceIndexPath,
    publicMethods,
    adminMethods,
  };
}

function renderServiceMarkdown(doc: ServiceDoc): string {
  const lines: string[] = [];
  lines.push(`# ${doc.serviceName}`);
  lines.push("");
  lines.push(`Source: ${path.relative(MONOREPO_ROOT, doc.filePath)}`);
  lines.push("");

  if (doc.publicMethods.length) {
    lines.push("## Public Methods");
    lines.push("");
    for (const m of doc.publicMethods) {
      lines.push(`### ${m.name}`);
      if (m.description) {
        lines.push("");
        lines.push(m.description);
      }
      lines.push("");
      lines.push(`- Access: ${m.access}`);
      lines.push(`- Entry-scoped: ${m.entryScoped ? "Yes" : "No"}`);
      lines.push("");
      lines.push("#### Payload");
      lines.push("\n```ts\n" + m.payloadType + "\n```\n");
      lines.push("#### Response");
      lines.push("\n```ts\n" + m.responseType + "\n```\n");
    }
  }

  const enabledAdmins = doc.adminMethods.filter((a) => a.enabled);
  if (enabledAdmins.length) {
    lines.push("## Admin Methods");
    lines.push("");
    for (const a of enabledAdmins) {
      const spec = ADMIN_METHOD_SPECS[a.name];
      lines.push(`### ${a.name}`);
      lines.push("");
      lines.push(`- Access: ${a.access}`);
      if (spec?.description) lines.push(`- Description: ${spec.description}`);
      if (spec) {
        lines.push("");
        lines.push("#### Payload");
        lines.push("\n```ts\n" + spec.payload + "\n```\n");
        lines.push("#### Response");
        lines.push("\n```ts\n" + spec.response + "\n```\n");
      }
    }
  }

  return lines.join("\n");
}

function run() {
  ensureDir(OUTPUT_DIR);
  cleanOutputDir(OUTPUT_DIR);

  const serviceFolders = getServiceFolders();
  const indexFiles = serviceFolders.map((dir) => path.join(dir, "index.ts"));
  const program = createProgram(indexFiles);

  for (const file of indexFiles) {
    const doc = parseServiceFile(file, program);
    if (!doc) continue;
    const outPath = path.join(
      OUTPUT_DIR,
      `${path.basename(path.dirname(file))}.md`
    );
    const md = renderServiceMarkdown(doc);
    fs.writeFileSync(outPath, md, "utf8");
    // eslint-disable-next-line no-console
    console.log(`Generated: ${path.relative(MONOREPO_ROOT, outPath)}`);
  }

  // eslint-disable-next-line no-console
  console.log("Service docs generated.");

  // Also emit shared/generated/tools.ts
  const toolsOutDir = path.join(MONOREPO_ROOT, "shared", "generated");
  ensureDir(toolsOutDir);
  const toolSpecs: string[] = [];
  const byService: Record<string, string[]> = {};
  for (const file of indexFiles) {
    const doc = parseServiceFile(file, program);
    if (!doc) continue;
    for (const m of doc.publicMethods) {
      const name = `${doc.serviceName}:${m.name}`;
      const svc = doc.serviceName;
      toolSpecs.push(
        `{ name: ${JSON.stringify(name)}, service: ${JSON.stringify(
          svc
        )}, method: ${JSON.stringify(m.name)}, access: ${JSON.stringify(
          m.access
        )}, entryScoped: ${m.entryScoped}, payloadType: ${JSON.stringify(
          m.payloadType
        )}, responseType: ${JSON.stringify(m.responseType)} }`
      );
      byService[svc] = byService[svc] || [];
      byService[svc].push(name);
    }
  }
  const toolsFile = `// AUTO-GENERATED by generateServiceDocs.ts\nexport type ToolSpec = { name: string; service: string; method: string; access: string; entryScoped: boolean; payloadType: string; responseType: string };\nexport const ALL_TOOLS: ToolSpec[] = [${toolSpecs.join(
    ","
  )}];\nexport const TOOLS_BY_SERVICE: Record<string, ToolSpec[]> = ALL_TOOLS.reduce((acc, t) => { (acc[t.service] = acc[t.service] || []).push(t); return acc; }, {} as Record<string, ToolSpec[]>);\n`;
  fs.writeFileSync(path.join(toolsOutDir, "tools.ts"), toolsFile, "utf8");
  // eslint-disable-next-line no-console
  console.log(
    `Generated: ${path.relative(
      MONOREPO_ROOT,
      path.join(toolsOutDir, "tools.ts")
    )}`
  );
}

run();
