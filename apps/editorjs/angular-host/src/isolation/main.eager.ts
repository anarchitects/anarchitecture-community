// Negative control only: this entry is excluded from ordinary CSR/SSR builds.
import EditorJS from '@editorjs/editorjs';
import '../ssr/main';

// Retain the eager import in optimized output without creating an editor holder.
Object.assign(window, { isolationEagerEditor: EditorJS });
