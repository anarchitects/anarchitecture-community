/** Browser-only: upstream evaluates window and injects global styles. */
import UpstreamImage from '@editorjs/image';
import type {
  BlockTool,
  BlockToolConstructable,
  BlockToolConstructorOptions,
  PasteEvent,
} from '@editorjs/editorjs';
import type { ImageConfig, ImageData, ImageFile } from './lib/image.js';
import { validateImageConfig, validateImageData } from './lib/image.js';
import {
  normalizeOutputData,
  type ImageUploader,
} from '@anarchitects/editorjs-core';

/** Public composition seams only; no access to upstream private UI/data/upload handlers. */
export class ImageTool implements BlockTool {
  static get toolbox() {
    return UpstreamImage.toolbox;
  }
  static get pasteConfig() {
    return UpstreamImage.pasteConfig;
  }
  static get isReadOnlySupported() {
    return true;
  }
  // Preserve authored plain text literally. Hosts emit it via DOM alt/text APIs, never HTML interpolation.
  static get sanitize() {
    return { alt: true, file: true, caption: {} };
  }
  private upstream: UpstreamImage;
  private readonly createUpstream: (data: Partial<ImageData>) => UpstreamImage;
  private readonly options: BlockToolConstructorOptions<
    Partial<ImageData>,
    ImageConfig<Blob>
  >;
  private active = true;
  private alt: string | undefined;
  private root?: HTMLDivElement;
  private observer?: MutationObserver;
  private readonly events = new AbortController();

  constructor(
    options: BlockToolConstructorOptions<Partial<ImageData>, ImageConfig<Blob>>,
  ) {
    validateImageConfig(options.config);
    this.options = options;
    if (
      options.data.alt !== undefined &&
      (typeof options.data.alt !== 'string' ||
        (options.data.alt !== '' && !options.data.alt.trim()))
    )
      throw new TypeError(
        'Invalid image alt. Validate persisted image data before editing.',
      );
    this.alt = options.data.alt;
    const host = options.config.uploader;
    const uploader = bridgeUploader(
      host,
      () => this.active,
      (file) => this.settled(file),
    );
    const api = {
      ...options.api,
      notifier: {
        ...options.api.notifier,
        show: (...args: Parameters<typeof options.api.notifier.show>) => {
          if (this.active) return options.api.notifier.show(...args);
          return undefined;
        },
      },
    };
    this.createUpstream = (data) =>
      new UpstreamImage({
        ...options,
        api,
        data: data as ImageData,
        config: { ...options.config, endpoints: {}, uploader },
      });
    this.upstream = this.createUpstream(options.data);
  }

  render(): HTMLDivElement {
    if (this.root) return this.root;
    const root = document.createElement('div');
    root.className = 'anarchitects-image';
    const upstream = this.upstream.render();
    upstream.inert = this.options.readOnly;
    const group = document.createElement('fieldset');
    const legend = document.createElement('legend');
    const t = (text: string) => this.options.api.i18n.t(text);
    legend.textContent = t('Image alternative text');
    const modeLabel = document.createElement('label');
    modeLabel.append(t('Image purpose'));
    const mode = document.createElement('select');
    for (const [value, label] of [
      ['unset', 'Not set'],
      ['description', 'Describe image'],
      ['decorative', 'Decorative (no alternative text)'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = t(label);
      mode.append(option);
    }
    mode.value =
      this.alt === undefined
        ? 'unset'
        : this.alt === ''
          ? 'decorative'
          : 'description';
    mode.disabled = this.options.readOnly;
    modeLabel.append(mode);
    const descriptionLabel = document.createElement('label');
    descriptionLabel.append(t('Alternative text'));
    const description = document.createElement('textarea');
    description.value = this.alt ?? '';
    description.disabled =
      this.options.readOnly || mode.value !== 'description';
    descriptionLabel.append(description);
    const update = () => {
      description.disabled =
        this.options.readOnly || mode.value !== 'description';
      this.alt =
        mode.value === 'decorative'
          ? ''
          : mode.value === 'description' && description.value.trim()
            ? description.value
            : undefined;
      this.updateImages();
      this.options.block.dispatchChange();
    };
    mode.addEventListener('change', update, { signal: this.events.signal });
    description.addEventListener('input', update, {
      signal: this.events.signal,
    });
    // Keep native select/textarea editing keys out of Editor.js block navigation.
    group.addEventListener('keydown', (event) => event.stopPropagation(), {
      signal: this.events.signal,
    });
    group.append(legend, modeLabel, descriptionLabel);
    root.append(upstream, group);
    this.root = root;
    this.updateImages();
    this.observer = new MutationObserver(() => this.updateImages());
    this.observer.observe(root, { childList: true, subtree: true });
    return root;
  }
  private settled(file?: ImageFile): void {
    if (!this.active) return;
    const data = { ...this.upstream.save(), ...(file ? { file } : {}) };
    // Upstream preview FileReader can finish AFTER a fast upload outcome. Recreate
    // via public seams so its late preview/result callbacks only touch detached UI.
    this.upstream = this.createUpstream(data);
    const view = this.upstream.render();
    view.inert = this.options.readOnly;
    this.root?.firstElementChild?.replaceWith(view);
    this.updateImages();
    this.options.block.dispatchChange();
  }
  private updateImages(): void {
    for (const image of this.root?.querySelectorAll('img') ?? []) {
      if (this.alt === undefined) image.removeAttribute('alt');
      else image.alt = this.alt;
    }
  }
  save(): ImageData {
    return {
      ...this.upstream.save(),
      ...(this.alt === undefined ? {} : { alt: this.alt }),
    };
  }
  validate(data: ImageData): boolean {
    return validateImageData(data).ok;
  }
  renderSettings() {
    return this.options.readOnly ? [] : this.upstream.renderSettings();
  }
  appendCallback(): void {
    if (this.active && !this.options.readOnly) this.upstream.appendCallback();
  }
  async onPaste(event: PasteEvent): Promise<void> {
    if (this.active && !this.options.readOnly)
      await this.upstream.onPaste(event);
  }
  removed(): void {
    this.destroy();
  }
  destroy(): void {
    this.active = false;
    this.observer?.disconnect();
    this.events.abort();
  }
}

/** Each instance keeps host receiver semantics. Started work settles normally after removal. */
function bridgeUploader(
  host: ImageUploader<Blob>,
  active: () => boolean,
  settled: (file?: ImageFile) => void,
) {
  const invoke = async (operation: () => Promise<unknown>) => {
    try {
      if (!active()) throw new Error('Image owner has been removed.');
      const response = await operation();
      if (!response || typeof response !== 'object' || !('success' in response))
        throw new TypeError('Invalid image upload response.');
      if (response.success === 0)
        throw new Error('Image upload failed.', {
          cause: 'error' in response ? response.error : undefined,
        });
      if (
        response.success !== 1 ||
        !('file' in response) ||
        'error' in response
      )
        throw new TypeError('Invalid image upload success.');
      const normalized = normalizeOutputData({
        blocks: [{ type: 'image', data: { file: response.file } }],
      });
      if (!normalized.ok)
        throw new TypeError(
          'Image upload file metadata must be JSON-compatible.',
        );
      const file: unknown = Reflect.get(normalized.data.blocks[0].data, 'file');
      if (
        !file ||
        typeof file !== 'object' ||
        Array.isArray(file) ||
        !('url' in file) ||
        typeof file.url !== 'string' ||
        !file.url.trim()
      )
        throw new TypeError('Image upload requires a nonblank file URL.');
      settled(file as ImageFile);
      return { success: 1, file: file as ImageFile };
    } catch (error) {
      settled();
      throw error;
    }
  };
  return {
    uploadByFile: (file: Blob) => invoke(() => host.uploadByFile(file)),
    uploadByUrl: (url: string) => invoke(() => host.uploadByUrl(url)),
  };
}
ImageTool satisfies BlockToolConstructable;
