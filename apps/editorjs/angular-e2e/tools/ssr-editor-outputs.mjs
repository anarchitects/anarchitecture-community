import { basename, join } from 'node:path';

/** Guard emitted browser implementations, not neutral recipes sharing a folder. */
export function editorServerOutputs(stats, output) {
  return Object.entries(stats.outputs)
    .filter(
      ([file, details]) =>
        file.endsWith('.mjs') &&
        Object.entries(details.inputs).some(
          ([input, details]) =>
            details.bytesInOutput > 0 &&
            (input.includes('@editorjs/editorjs/') ||
              input.includes('/registry/tools/') ||
              input.includes('/common/tools/') ||
              /(?:^|\/)examples\/(?:notebook\/)?custom\/(?:callout-tool|marker-tool|flag-tune)\.ts$/.test(
                input,
              ) ||
              input.includes('@editorjs/code/') ||
              /@editorjs\/(paragraph|header|list|quote|image)\//.test(input)),
        ),
    )
    .map(([file]) => join(output, 'server', basename(file)));
}
