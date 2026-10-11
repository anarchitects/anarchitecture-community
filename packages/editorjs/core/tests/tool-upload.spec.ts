import type {
  EditorConfig,
  ToolConstructable,
  ToolSettings,
} from '@editorjs/editorjs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  FileUploader,
  ImageUploader,
  ToolConfiguration,
  ToolConstructor,
  ToolOptions,
  ToolRegistration,
  ToolboxEntry,
  UploadedFile,
  UploadFailure,
  UploadResponse,
  UploadSuccess,
  UrlUploader,
} from '../src/index.js';

interface ByteInput {
  name: string;
  bytes: Uint8Array;
}

interface ImageFile extends UploadedFile {
  assetId: string;
  width: number;
}

interface HostError {
  code: 'unsupported' | 'unavailable';
  message: string;
}

interface ImageConfig {
  uploader: ImageUploader<ByteInput, ImageFile, HostError>;
  captionPlaceholder?: string;
}

interface ImageData {
  file: ImageFile;
  caption: string;
}

// A host owns the real rendering implementation and editor constructor contract.
class CustomTool {
  constructor(readonly options: { config?: ImageConfig }) {}
}

describe('tool configuration contracts', () => {
  it('preserves the supplied class and typed configuration without constructing it', () => {
    const registration: ToolRegistration<
      typeof CustomTool,
      ImageConfig,
      ImageData
    > = {
      class: CustomTool,
      inlineToolbar: ['bold'],
      tunes: ['alignment'],
      shortcut: 'CMD+SHIFT+I',
      toolbox: [{ title: 'Image', data: { caption: 'Initial caption' } }],
    };
    expect(registration.class).toBe(CustomTool);
    expectTypeOf(registration.class).toEqualTypeOf<typeof CustomTool>();
    expectTypeOf<typeof CustomTool>().toExtend<ToolConstructor>();
    expectTypeOf<typeof CustomTool>().toExtend<
      ToolRegistration<typeof CustomTool>
    >();
    expectTypeOf<{
      toolbox: false;
      inlineToolbar: false;
      tunes: true;
    }>().toExtend<ToolOptions>();
    expectTypeOf<{ data: { caption: number } }>().not.toExtend<
      ToolboxEntry<ImageData>
    >();
    expectTypeOf<{ captionPlaceholder: number }>().not.toExtend<
      Partial<ImageConfig>
    >();
    expectTypeOf<() => object>().not.toExtend<ToolConstructor>();
    expectTypeOf<{ class: string }>().not.toExtend<ToolConfiguration>();
  });

  it('fits official settings when the host supplies an Editor.js tool class', () => {
    type Configuration = ToolConfiguration<
      ToolConstructable,
      ImageConfig,
      ImageData
    >;
    expectTypeOf<Configuration>().toExtend<ToolSettings<ImageConfig>>();
    expectTypeOf<ToolSettings<ImageConfig>>().not.toExtend<Configuration>();
    expectTypeOf<{
      tools: {
        image: ToolRegistration<ToolConstructable, ImageConfig, ImageData>;
      };
    }>().toExtend<EditorConfig>();
  });
});

describe('upload contracts', () => {
  it('lets hosts supply file and URL transport with typed success and failure results', async () => {
    const uploader: ImageUploader<ByteInput, ImageFile, HostError> = {
      uploadByFile: async (input) => ({
        success: 1,
        file: { url: `/assets/${input.name}`, assetId: 'asset-1', width: 640 },
      }),
      uploadByUrl: async () => ({
        success: 0,
        error: {
          code: 'unsupported',
          message: 'URL uploads are disabled by the host',
        },
      }),
    };
    const response = await uploader.uploadByFile({
      name: 'image.png',
      bytes: new Uint8Array([1, 2]),
    });
    if (response.success === 1) {
      expectTypeOf(response.file).toEqualTypeOf<ImageFile>();
      expect(response.file.assetId).toBe('asset-1');
    } else {
      throw new Error('Expected the successful host response');
    }
    const failure = await uploader.uploadByUrl('https://example.com/image.png');
    if (failure.success === 0) {
      expectTypeOf(failure.error).toEqualTypeOf<HostError | undefined>();
      expect(failure.error?.code).toBe('unsupported');
    } else {
      throw new Error('Expected the failed host response');
    }
    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
    expect(JSON.parse(JSON.stringify(failure))).toEqual(failure);
  });

  it('rejects malformed responses and incompatible transport inputs at compile time', () => {
    expectTypeOf<{
      success: 1;
      file: { url: string };
    }>().toExtend<UploadSuccess>();
    expectTypeOf<{ success: 0 }>().toExtend<UploadFailure>();
    expectTypeOf<UploadFailure['error']>().toBeUnknown();
    expectTypeOf<{ success: 1 }>().not.toExtend<UploadResponse>();
    expectTypeOf<{
      success: true;
      file: { url: string };
    }>().not.toExtend<UploadResponse>();
    expectTypeOf<{
      success: 1;
      file: { url: number };
    }>().not.toExtend<UploadResponse>();
    expectTypeOf<{
      success: 0;
      file: UploadedFile;
    }>().not.toExtend<UploadResponse>();
    expectTypeOf<{
      success: 1;
      file: UploadedFile;
      error: HostError;
    }>().not.toExtend<UploadResponse>();
    expectTypeOf<FileUploader<ByteInput>>().not.toExtend<
      FileUploader<string>
    >();
    expectTypeOf<FileUploader<ByteInput>>().not.toExtend<
      ImageUploader<ByteInput>
    >();
    expectTypeOf<ImageUploader<ByteInput>>().toExtend<UrlUploader>();
    expectTypeOf<
      Parameters<ImageUploader<File>['uploadByFile']>[0]
    >().toEqualTypeOf<File>();
    // @ts-expect-error A successful result must include a URL in its file metadata.
    expectTypeOf<UploadResponse<{ assetId: string }>>();
  });
});
