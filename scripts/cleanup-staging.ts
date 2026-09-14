import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { adminDb } = await import("../src/lib/supabase/admin");
  const db = adminDb();
  const { data: users, error } = await db.from("profiles").select("id");
  if (error) throw new Error("Could not list profile owners.");
  let removed = 0;
  for (const user of users || []) {
    const root = user.id + "/staging";
    const { data: folders, error } = await db.storage
      .from("theses")
      .list(root, { limit: 1000 });
    if (error) throw new Error("Could not list staging objects.");
    for (const folder of folders || []) {
      const { data: files } = await db.storage
        .from("theses")
        .list(root + "/" + folder.name, { limit: 100 });
      const stale = (files || []).filter(
        (file) =>
          file.created_at &&
          Date.parse(file.created_at) < Date.now() - 24 * 60 * 60 * 1000,
      );
      if (stale.length) {
        const { error } = await db.storage
          .from("theses")
          .remove(stale.map((f) => root + "/" + folder.name + "/" + f.name));
        if (error) throw new Error("Staging cleanup failed.");
        removed += stale.length;
      }
    }
  }
  // Finalization may be interrupted after the immutable file is copied but before SQL commits.
  for (const user of users || []) {
    const { data: folders, error } = await db.storage
      .from("theses")
      .list(user.id, { limit: 1000 });
    if (error) throw new Error("Could not list upload folders.");
    for (const folder of folders || []) {
      if (folder.name === "staging") continue;
      const { data: files, error: listError } = await db.storage
        .from("theses")
        .list(user.id + "/" + folder.name, { limit: 100 });
      if (listError) throw new Error("Could not inspect upload folder.");
      for (const file of files || []) {
        if (
          !file.created_at ||
          Date.parse(file.created_at) >= Date.now() - 86400000
        )
          continue;
        const path = user.id + "/" + folder.name + "/" + file.name;
        const { data: reference, error: lookupError } = await db
          .from("theses")
          .select("id")
          .eq("document_path", path)
          .maybeSingle();
        if (lookupError)
          throw new Error(
            "Could not verify document references; cleanup stopped.",
          );
        if (!reference) {
          const { error: removeError } = await db.storage
            .from("theses")
            .remove([path]);
          if (removeError)
            throw new Error("Unreferenced upload cleanup failed.");
          removed++;
        }
      }
    }
  }
  console.log(
    "Removed " + removed + " abandoned upload files older than 24 hours.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
