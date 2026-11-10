import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderAuthActionEmail } from "../src/modules/auth/infrastructure/auth-email-template.js";

const outputDirectory = path.resolve("tmp/email-previews");
await mkdir(outputDirectory, { recursive: true });
const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
const code = "48271936";

for (const purpose of ["EMAIL_VERIFICATION", "PASSWORD_RESET", "CLUB_INVITATION"] as const) {
  const rendered = renderAuthActionEmail({ purpose, code: purpose === "CLUB_INVITATION" ? "K7M2-P9Q4-X6RT" : code, expiresAt, ...(purpose === "CLUB_INVITATION" ? { context: { clubName: "Club Central", institutionName: "Universidad Linda Vista" } } : {}) });
  const filename = purpose === "EMAIL_VERIFICATION" ? "email-verification.html" : purpose === "PASSWORD_RESET" ? "password-reset.html" : "club-invitation.html";
  await writeFile(path.join(outputDirectory, filename), rendered.html, "utf8");
}

process.stdout.write(`${outputDirectory}\n`);
