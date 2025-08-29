import path from "path";
import { ADMIN_METHOD_SPECS } from "./generateServiceDocs.adminSpecs";

export type PublicMethodDoc = {
  name: string;
  access: string;
  payloadType: string;
  responseType: string;
  entryScoped: boolean;
  description?: string;
};

export type AdminMethodDoc = {
  name: string;
  access: string;
  enabled: boolean;
};

export type ServiceDoc = {
  serviceName: string;
  filePath: string;
  publicMethods: PublicMethodDoc[];
  adminMethods: AdminMethodDoc[];
};

const MONOREPO_ROOT = path.resolve(path.join(process.cwd(), ".."));

export function renderServiceMarkdown(doc: ServiceDoc): string {
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
