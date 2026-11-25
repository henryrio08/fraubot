import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "./sites-env.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
const sourceConfig = path.join(root, ".cloudflare/wrangler.json");
const builtConfig = path.join(root, ".cloudflare/dist/server/wrangler.json");
const action = process.argv[2];
function run(args, options = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Cloudflare command did not finish. Check its output and retry.");
  return result;
}
function build() {
  run(["scripts/run-framework.mjs", "build"], { env: { ...process.env, FRAUBOT_DEPLOY_TARGET: "cloudflare" } });
  rmSync(".cloudflare/dist", { recursive: true, force: true });
  cpSync("dist", ".cloudflare/dist", { recursive: true, force: true });
  console.log("Standalone build ready in .cloudflare/dist (nickname-only access).");
}
try {
  if (action === "login") run([wrangler, "login", "--scopes", "account:read", "user:read", "workers:write", "d1:write"]);
  else if (action === "dev") {
    process.env.FRAUBOT_DEPLOY_TARGET = "cloudflare";
    process.argv = [process.execPath, "scripts/run-framework.mjs", "dev", "--host", "127.0.0.1"];
    await import("./run-framework.mjs");
  }
  else if (action === "local-db") run(["--import", "./scripts/sites-env.mjs", wrangler, "d1", "migrations", "apply", "DB", "--local", "--config", existsSync(sourceConfig) ? sourceConfig : "wrangler.standalone.json"]);
  else if (action === "build") build();
  else if (action === "deploy") {
    const auth = spawnSync(process.execPath, [wrangler, "whoami"], { encoding: "utf8" });
    if (auth.status !== 0 || /not authenticated|not logged in/i.test((auth.stdout || "") + (auth.stderr || ""))) throw new Error("Run npm run cloudflare:login, approve access in your browser, then run npm run cloudflare:deploy.");
    const values = existsSync(".dev.vars") ? parseEnv(readFileSync(".dev.vars", "utf8")) : {};
    const modelKey = process.env.MODEL_API_KEY || values.MODEL_API_KEY;
    if (!modelKey) throw new Error("Add MODEL_API_KEY to the ignored .dev.vars file before deploying.");
    mkdirSync(".cloudflare", { recursive: true });
    if (!existsSync(sourceConfig)) {
      const config = JSON.parse(readFileSync("wrangler.standalone.json", "utf8"));
      config.$schema = "../node_modules/wrangler/config-schema.json";
      config.main = "../worker/standalone.ts";
      config.d1_databases = [];
      writeFileSync(sourceConfig, JSON.stringify(config, null, 2) + "\n");
    }
    let config = JSON.parse(readFileSync(sourceConfig, "utf8"));
    if (!config.d1_databases?.some(binding => binding.binding === "DB")) {
      run([wrangler, "d1", "create", "fraubot-classroom", "--binding", "DB", "--update-config", "--config", sourceConfig]);
      config = JSON.parse(readFileSync(sourceConfig, "utf8"));
    }
    const binding = config.d1_databases?.find(binding => binding.binding === "DB");
    if (!binding?.database_id || binding.database_id === "00000000-0000-4000-8000-000000000000") throw new Error("Cloudflare did not return a database ID; no deployment was attempted.");
    binding.migrations_dir = "../drizzle";
    writeFileSync(sourceConfig, JSON.stringify(config, null, 2) + "\n");
    run([wrangler, "d1", "migrations", "apply", "DB", "--remote", "--config", sourceConfig]);
    build();
    run([wrangler, "deploy", "--config", builtConfig]);
    // The Meta credential travels through stdin, never command arguments or a
    // new file. Wrangler stores it as a Worker secret, not a public variable.
    run([wrangler, "secret", "bulk", "--config", builtConfig], { input: JSON.stringify({ MODEL_API_KEY: modelKey }), encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });
    console.log("Cloudflare deployment and Meta secret upload finished. Use the workers.dev URL printed above.");
  } else throw new Error("Choose dev, local-db, build, login, or deploy.");
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
