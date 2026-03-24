import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['cjs'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  banner({ format }) {
    // Only add shebang for cli entry
    return {};
  },
});
