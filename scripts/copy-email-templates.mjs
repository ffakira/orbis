import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const source = resolve(
  projectRoot,
  "src/modules/outbox/infrastructure/email/templates",
);

const destination = resolve(
  projectRoot,
  "dist/modules/outbox/infrastructure/email/templates",
);

await mkdir(dirname(destination), { recursive: true });

await cp(source, destination, {
  recursive: true,
  force: true,
});

console.log("Email templates copied to dist.");
