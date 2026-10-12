import { fileURLToPath } from 'node:url';

let forbidden;
export function initialize(paths) {
  forbidden = new Set(paths);
}
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && forbidden.has(fileURLToPath(url))) {
    throw new Error('Editor.js server evaluation forbidden by SSR fixture');
  }
  return nextLoad(url, context);
}
