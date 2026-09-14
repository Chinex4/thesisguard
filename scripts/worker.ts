import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { adminDb } = await import("../src/lib/supabase/admin");
  const { runScan } = await import("../src/lib/services/scan");
  const db = adminDb();
  let stopping = false;
  process.on("SIGTERM", () => {
    stopping = true;
  });
  process.on("SIGINT", () => {
    stopping = true;
  });
  console.log("ThesisGuard scan worker ready");
  while (!stopping) {
    try {
      const { data: id, error } = await db.rpc("claim_scan");
      if (error) throw error;
      if (id) {
        console.log("Processing scan", id);
        await runScan(id);
      } else await new Promise((r) => setTimeout(r, 3000));
    } catch {
      console.error(
        "Worker database connection unavailable. Retrying in 10 seconds.",
      );
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}
main().catch(() => {
  console.error("Worker configuration is incomplete.");
  process.exit(1);
});
