import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createAdminAccount, findAdminByEmail } from "../server/polina-db";
import { hashPassword, validatePasswordRules } from "../server/_core/polina-auth";

function promptSecret(label: string) {
  return new Promise<string>((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Run this provisioning command from a private interactive terminal."));
      return;
    }

    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdout.write("\n");
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Provisioning cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const terminal = createInterface({ input: stdin, output: stdout });
  const rawEmail = (await terminal.question("Administrator email: ")).trim().toLowerCase();
  const name = (await terminal.question("Display name (optional): ")).trim();
  terminal.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) || rawEmail.length > 320) {
    throw new Error("Enter a valid administrator email address.");
  }

  const password = await promptSecret("Password (12–128 characters; input is hidden): ");
  const confirmation = await promptSecret("Confirm password (input is hidden): ");
  if (!validatePasswordRules(password)) throw new Error("Choose a password between 12 and 128 characters.");
  if (password !== confirmation) throw new Error("The passwords did not match.");
  if (await findAdminByEmail(rawEmail)) throw new Error("An administrator account already exists for that email.");

  const passwordHash = await hashPassword(password);
  await createAdminAccount({ email: rawEmail, name: name || null, passwordHash });
  stdout.write("Administrator provisioned. Sign in at /admin/login. Credentials were not written to project files.\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Administrator provisioning failed.";
  console.error(`Provisioning failed: ${message}`);
  process.exitCode = 1;
});
