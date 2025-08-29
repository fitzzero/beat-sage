import fs from "fs";
import path from "path";
import ts from "typescript";
import { renderServiceMarkdown } from "./generateServiceDocs.render";

// Paths
// Determine paths relative to the workspace the script is executed from.
// This script is run via the server workspace (cwd = <repo>/server).
const SERVER_WORKSPACE_ROOT = path.resolve(process.cwd());
const MONOREPO_ROOT = path.resolve(SERVER_WORKSPACE_ROOT, "..");
const SERVER_SRC = path.join(SERVER_WORKSPACE_ROOT, "src");
const SERVICES_DIR = path.join(SERVER_SRC, "services");
const OUTPUT_DIR = path.join(MONOREPO_ROOT, "docs", "services");

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
  // Use the server tsconfig for accurate path mappings and types
  const configPath = ts.findConfigFile(
    SERVER_WORKSPACE_ROOT,
    (p) => ts.sys.fileExists(p),
    "tsconfig.json"
  );
  if (configPath) {
    const configFile = ts.readConfigFile(configPath, (f) => ts.sys.readFile(f));
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      SERVER_WORKSPACE_ROOT
    );
    return ts.createProgram({ rootNames: filePaths, options: parsed.options });
  }
  // Fallback minimal options
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

function isDefineServiceMethodCall(
  expr: ts.Expression
): expr is ts.CallExpression {
  if (!ts.isCallExpression(expr)) return false;
  const callee = expr.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  if (callee.expression.kind !== ts.SyntaxKind.ThisKeyword) return false;
  const name = callee.name.text;
  // Support both legacy definePublicMethod and new defineMethod wrappers
  return name === "definePublicMethod" || name === "defineMethod";
}

function parseServiceFile(
  serviceIndexPath: string,
  program: ts.Program
): ServiceDoc | null {
  const source = program.getSourceFile(serviceIndexPath);
  if (!source) return null;

  const serviceNameFromPath = path.basename(path.dirname(serviceIndexPath));

  // Use TypeChecker to infer generic payload/response types when not explicitly provided
  const checker = program.getTypeChecker();

  const publicMethods: PublicMethodDoc[] = [];
  const adminMethods: AdminMethodDoc[] = [];
  let serviceName = serviceNameFromPath;
  let serviceMethodsType: ts.Type | null = null;

  function extractText(node: ts.Node): string {
    return node.getText(source as ts.SourceFile);
  }

  function visit(node: ts.Node) {
    // Capture TServiceMethods from class extends BaseService<..., TServiceMethods>
    if (ts.isClassDeclaration(node) && node.heritageClauses) {
      for (const h of node.heritageClauses) {
        if (h.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const t of h.types) {
            const expr = t.expression;
            const hasName =
              (ts.isIdentifier(expr) && expr.text === "BaseService") ||
              (ts.isPropertyAccessExpression(expr) &&
                expr.name.text === "BaseService");
            if (hasName && t.typeArguments && t.typeArguments.length >= 5) {
              const methodsNode = t.typeArguments[4];
              try {
                serviceMethodsType = checker.getTypeFromTypeNode(methodsNode);
              } catch (err) {
                void err;
                serviceMethodsType = null;
              }
            }
          }
        }
      }
    }
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
      isDefineServiceMethodCall(node.initializer)
    ) {
      const callExpr = node.initializer;
      const typeArgs = callExpr.typeArguments || [];
      let payloadType = typeArgs[0] ? extractText(typeArgs[0]) : "unknown";
      let responseType = typeArgs[1] ? extractText(typeArgs[1]) : "unknown";

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

      // Try to infer payload/response types using the TypeChecker when generics are omitted
      try {
        // Prefer extracting from the call's resolved signature return type (ServiceMethodDefinition<P, R>)
        if (payloadType === "unknown" || responseType === "unknown") {
          const sig = checker.getResolvedSignature(callExpr);
          if (sig) {
            const ret = checker.getReturnTypeOfSignature(sig);
            const ref = ret as unknown as { typeArguments?: ts.Type[] };
            const aliasArgs = (
              ret as unknown as { aliasTypeArguments?: ts.Type[] }
            ).aliasTypeArguments;
            const targs =
              ref && ref.typeArguments && ref.typeArguments.length >= 2
                ? ref.typeArguments
                : aliasArgs;
            if (targs && targs.length >= 2) {
              if (payloadType === "unknown") {
                payloadType = checker.typeToString(
                  targs[0],
                  callExpr,
                  ts.TypeFormatFlags.NoTruncation
                );
              }
              if (responseType === "unknown") {
                responseType = checker.typeToString(
                  targs[1],
                  callExpr,
                  ts.TypeFormatFlags.NoTruncation
                );
              }
            }

            // Fallback: inspect 'handler' property type of the returned object type alias
            if (payloadType === "unknown" || responseType === "unknown") {
              const props = ret.getProperties();
              const handlerSym = props.find((s) => s.getName() === "handler");
              if (handlerSym) {
                const hType = checker.getTypeOfSymbolAtLocation(
                  handlerSym,
                  callExpr
                );
                const hSigs = checker.getSignaturesOfType(
                  hType,
                  ts.SignatureKind.Call
                );
                const hSig = hSigs[0];
                if (hSig) {
                  if (payloadType === "unknown" && hSig.parameters[0]) {
                    const pSym = hSig.parameters[0];
                    const pType = checker.getTypeOfSymbolAtLocation(
                      pSym,
                      callExpr
                    );
                    const pStr = checker.typeToString(
                      pType,
                      callExpr,
                      ts.TypeFormatFlags.NoTruncation
                    );
                    if (pStr && pStr !== "any") payloadType = pStr;
                  }
                  if (responseType === "unknown") {
                    const rType = checker.getReturnTypeOfSignature(hSig);
                    let rStr = checker.typeToString(
                      rType,
                      callExpr,
                      ts.TypeFormatFlags.NoTruncation
                    );
                    const match = /^Promise<(.+)>$/.exec(rStr);
                    if (match) rStr = match[1];
                    if (rStr && rStr !== "any") responseType = rStr;
                  }
                }
              }
            }
          }
        }

        // Fallback: inspect the handler function's parameter and return type
        if (payloadType === "unknown" || responseType === "unknown") {
          const handler = args[2];
          if (
            handler &&
            (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))
          ) {
            // payload from first parameter
            if (payloadType === "unknown" && handler.parameters[0]) {
              const pType = checker.getTypeAtLocation(handler.parameters[0]);
              const pStr = checker.typeToString(
                pType,
                handler.parameters[0],
                ts.TypeFormatFlags.NoTruncation
              );
              if (pStr && pStr !== "any") payloadType = pStr;
            }
            // response from return type (unwrap Promise<...> if present)
            if (responseType === "unknown") {
              const hType = checker.getTypeAtLocation(handler);
              const hSigs = checker.getSignaturesOfType(
                hType,
                ts.SignatureKind.Call
              );
              const hSig = hSigs[0];
              if (hSig) {
                const rType = checker.getReturnTypeOfSignature(hSig);
                let rStr = checker.typeToString(
                  rType,
                  handler,
                  ts.TypeFormatFlags.NoTruncation
                );
                // unwrap Promise<T>
                const match = /^Promise<(.+)>$/.exec(rStr);
                if (match) rStr = match[1];
                if (rStr && rStr !== "any") responseType = rStr;
              }
            }
          }
        }
      } catch (err) {
        void err;
        // ignore type inference errors; keep "unknown"
      }

      // Map from TServiceMethods[K] if available
      if (
        (payloadType === "unknown" || responseType === "unknown") &&
        methodName &&
        serviceMethodsType
      ) {
        try {
          const methodSym = serviceMethodsType.getProperty(methodName);
          if (methodSym) {
            const methodSymType = checker.getTypeOfSymbolAtLocation(
              methodSym,
              node
            );
            const pSym = checker.getPropertyOfType(methodSymType, "payload");
            if (payloadType === "unknown" && pSym) {
              const pType = checker.getTypeOfSymbolAtLocation(pSym, node);
              const pStr = checker.typeToString(
                pType,
                node,
                ts.TypeFormatFlags.NoTruncation
              );
              if (pStr && pStr !== "any") payloadType = pStr;
            }
            const rSym = checker.getPropertyOfType(methodSymType, "response");
            if (responseType === "unknown" && rSym) {
              const rType = checker.getTypeOfSymbolAtLocation(rSym, node);
              const rStr = checker.typeToString(
                rType,
                node,
                ts.TypeFormatFlags.NoTruncation
              );
              if (rStr && rStr !== "any") responseType = rStr;
            }
          }
        } catch (err) {
          void err;
          // ignore lookup failures
        }
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

// renderServiceMarkdown moved to ./generateServiceDocs.render

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
