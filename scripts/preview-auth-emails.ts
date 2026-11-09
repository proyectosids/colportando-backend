import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderAuthActionEmail } from "../src/modules/auth/infrastructure/auth-email-template.js";

const outputDirectory = path.resolve("tmp/email-previews");
await mkdir(outputDirectory, { recursive: true });
const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
const token = "preview-token-not-valid-for-authentication";

for (const purpose of ["EMAIL_VERIFICATION", "PASSWORD_RESET"] as const) {
  const rendered = renderAuthActionEmail({ purpose, token, expiresAt, actionBaseUrl: "https://colportando.example/auth" });
  const filename = purpose === "EMAIL_VERIFICATION" ? "email-verification.html" : "password-reset.html";
  await writeFile(path.join(outputDirectory, filename), rendered.html, "utf8");
}

process.stdout.write(`${outputDirectory}\n`);
