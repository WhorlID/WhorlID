// Entry point for the CDN bundle only. esbuild wraps this as an IIFE exposing
// window.whorlid; npm consumers get index.ts instead.
export * from './index.js';
