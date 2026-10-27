/** Browser-only: evaluating upstream installs global styles. */
import Header from '@editorjs/header';
import type { BlockToolConstructable } from '@editorjs/editorjs';

export const HeaderTool = Header satisfies BlockToolConstructable;
