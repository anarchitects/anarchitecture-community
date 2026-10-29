// Negative control only: this entry is excluded from ordinary CSR/SSR builds.
import EditorJS from '@editorjs/editorjs';
import { Card } from '../registry/tools/card';
import { Paragraph } from '../common/tools/paragraph';
import { Header } from '../common/tools/header';
import { List } from '../common/tools/list';
import { Quote } from '../common/tools/quote';
import { Image } from '../common/tools/image';
import { createBackend } from '../upload/backend';
import '../ssr/main';

// Retain the eager import in optimized output without creating an editor holder.
Object.assign(window, {
  isolationEagerEditor: EditorJS,
  isolationEagerTool: Card,
  isolationEagerCommon: [Paragraph, Header, List, Quote, Image],
  isolationEagerUpload: createBackend,
});
