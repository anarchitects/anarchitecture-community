/** Browser-only: evaluating upstream installs global styles. */
import Quote from '@editorjs/quote';
import type { BlockToolConstructable } from '@editorjs/editorjs';

export const QuoteTool = Quote satisfies BlockToolConstructable;
