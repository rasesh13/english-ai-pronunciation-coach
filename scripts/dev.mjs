import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import nextEnvironment from "@next/env";

const workspace = process.cwd();
const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(workspace);
const nextBinary = path.join(workspace, "node_modules", "next", "dist", "bin", "next");
const windowsVenvPython = path.join(workspace, "backend", ".venv", "Scripts", "python.exe");
const unixVenvPython = path.join(workspace, "backend", ".venv", "bin", "python");
const python = existsSync(windowsVenvPython) ? windowsVenvPython : existsSync(unixVenvPython) ? unixVenvPython : "python";
const sharedEnvironment = { ...process.env, FASTAPI_URL: process.env.FASTAPI_URL || "http://127.0.0.1:8000" };

const api = spawn(python, ["-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"], { cwd: workspace, env: sharedEnvironment, stdio: "inherit", windowsHide: true });
const web = spawn(process.execPath, [nextBinary, "dev"], { cwd: workspace, env: sharedEnvironment, stdio: "inherit", windowsHide: true });
const children = [api, web];

function stop(exitCode = 0) {
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exit(exitCode);
}

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) stop(code);
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
