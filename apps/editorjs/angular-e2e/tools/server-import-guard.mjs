import { register } from 'node:module';

// Block actual loading of Editor.js-containing server outputs, as identified by
// the builder's input/output graph. No browser globals are installed or replaced.
register('./server-import-hook.mjs', import.meta.url, {
  data: JSON.parse(process.env['FIXTURE_FORBIDDEN_OUTPUTS']),
});
