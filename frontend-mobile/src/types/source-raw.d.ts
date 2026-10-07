/** Vite's raw-source loader is used only by structural navigation regression tests. */
declare module "*?raw" { const source: string; export default source; }
