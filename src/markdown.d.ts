// Ambient module for .md imports — see next.config.ts's webpack() for the loader rule
// that turns these into raw-text (string) modules at build time.
declare module '*.md' {
  const content: string;
  export default content;
}
