#!/usr/bin/env node
import path from "node:path";
import { startMcpServer } from "./index.js";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
startMcpServer(root).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
