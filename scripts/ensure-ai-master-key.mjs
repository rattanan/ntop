import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const environmentPath = resolve(process.cwd(), ".env");
const variableName = "AI_CONFIG_MASTER_KEY";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to generate an AI master key in production. Use the approved secret store.");
}

const current = await readFile(environmentPath, "utf8");
const assignment = current.match(/^AI_CONFIG_MASTER_KEY=(?:"([^"]*)"|'([^']*)'|([^\r\n]*))$/m);

if (assignment) {
  const value = assignment[1] ?? assignment[2] ?? assignment[3] ?? "";
  const decoded = Buffer.from(value, "base64");
  if (decoded.byteLength !== 32 || decoded.toString("base64") !== value) {
    throw new Error("AI_CONFIG_MASTER_KEY exists but is not a canonical Base64-encoded 32-byte key.");
  }
  console.log("AI_CONFIG_MASTER_KEY is already configured and valid.");
} else {
  const separator = current.endsWith("\n") || current.length === 0 ? "" : "\n";
  const generated = randomBytes(32).toString("base64");
  await writeFile(environmentPath, `${current}${separator}${variableName}="${generated}"\n`, { mode: 0o600 });
  console.log("Generated AI_CONFIG_MASTER_KEY in the ignored local .env file. The key value was not printed.");
}
