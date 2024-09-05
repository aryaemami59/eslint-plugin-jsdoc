import { runAsWorker } from "synckit";

runAsWorker(async (imprt: string) => {
  const { parseImports } = await import("parse-imports");
  try {
    // ESLint doesn't support async rules
    return [...(await parseImports(imprt))];
  } catch (err) {
    return false;
  }
});
