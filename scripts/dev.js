import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "cmd.exe" : "npm";
const frontendHost = process.env.FRONTEND_HOST || "0.0.0.0";
const frontendPort = process.env.FRONTEND_PORT || "5173";
const children = [];

const processes = [
  {
    name: "server",
    cwd: path.join(rootDir, "server"),
    args: ["run", "dev"]
  },
  {
    name: "client",
    cwd: path.join(rootDir, "client"),
    args: ["run", "dev", "--", "--host", frontendHost, "--port", frontendPort]
  }
];

function createChildEnv(extraEnv = {}) {
  const env = {};
  const seenKeys = new Set();

  for (const [key, value] of Object.entries(process.env)) {
    const normalizedKey = key.toLowerCase();
    if (seenKeys.has(normalizedKey)) continue;

    seenKeys.add(normalizedKey);
    env[key] = value;
  }

  const pathValue = process.env.Path || process.env.PATH;
  if (pathValue) {
    delete env.PATH;
    env.Path = pathValue;
  }

  env.FORCE_COLOR = "1";
  Object.assign(env, extraEnv);
  return env;
}

function prefixOutput(name, chunk, stream) {
  const lines = chunk.toString().split(/\r?\n/);
  for (const line of lines) {
    if (line.trim()) {
      stream.write(`[${name}] ${line}\n`);
    }
  }
}

function stopAll(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

function commandArgs(args) {
  if (process.platform !== "win32") return args;
  return ["/d", "/s", "/c", `npm ${args.join(" ")}`];
}

for (const processConfig of processes) {
  const child = spawn(npmCommand, commandArgs(processConfig.args), {
    cwd: processConfig.cwd,
    env: createChildEnv(processConfig.name === "client" ? { VITE_API_PORT: process.env.PORT || "4242" } : {}),
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  children.push(child);
  child.stdout.on("data", (chunk) => prefixOutput(processConfig.name, chunk, process.stdout));
  child.stderr.on("data", (chunk) => prefixOutput(processConfig.name, chunk, process.stderr));
  child.on("exit", (code, signal) => {
    if (code === 0 || signal) return;
    console.error(`[${processConfig.name}] exited with code ${code}`);
    stopAll();
    process.exitCode = code || 1;
  });
}

process.on("SIGINT", () => {
  stopAll("SIGINT");
  process.exit(130);
});

process.on("SIGTERM", () => {
  stopAll("SIGTERM");
  process.exit(143);
});
