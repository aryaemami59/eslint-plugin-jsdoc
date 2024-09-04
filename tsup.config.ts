import type { Options } from "tsup";
import { defineConfig } from "tsup";

const tsconfig = "tsconfig.build.json" satisfies Options["tsconfig"];

export default defineConfig((overrideOptions) => {
  const commonOptions = {
    clean: true,
    entry: ["src/index.js"],
    removeNodeProtocol: false,
    shims: true,
    sourcemap: true,
    splitting: false,
    target: ["esnext"],
    tsconfig,
    ...overrideOptions,
  } satisfies Options;

  return [
    {
      ...commonOptions,
      dts: true,
      format: ["cjs", "esm"],
    },
  ];
});
