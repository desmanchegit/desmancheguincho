import Database from "better-sqlite3";
import { parentPort, workerData } from "node:worker_threads";
import { createPerTransactionBillingStore } from "../dist/per-transaction-billing.mjs";

const { filename, input, worker, startGate: startGateBuffer, holdGate: holdGateBuffer } = workerData;
const startGate = new Int32Array(startGateBuffer);
const holdGate = new Int32Array(holdGateBuffer);
const sqlite = new Database(filename);
sqlite.pragma("busy_timeout = 5000");
sqlite.function("test_hold_after_lock", () => {
  parentPort.postMessage({ type: "locked", worker });
  Atomics.wait(holdGate, 0, 0, 5_000);
  return 0;
});

try {
  const store = createPerTransactionBillingStore(sqlite);
  parentPort.postMessage({ type: "ready", worker });
  if (Atomics.wait(startGate, 0, 0, 5_000) === "timed-out") throw new Error("Timed out at SQLite start barrier");
  parentPort.postMessage({ type: "starting", worker });
  parentPort.postMessage({ type: "result", worker, result: store.createOrGetPerTransactionBilling(input) });
} catch (error) {
  parentPort.postMessage({ type: "error", worker, error: { message: error.message, code: error.code } });
} finally {
  sqlite.close();
}
