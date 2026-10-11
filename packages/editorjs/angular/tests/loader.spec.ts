// @vitest-environment jsdom
import '@angular/compiler';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  PLATFORM_ID,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import type { EditorConfig } from '@editorjs/editorjs';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  EDITOR_JS_LOADER,
  provideEditorJsLoader,
  type EditorJsConfig,
  type EditorJsInstance,
  type EditorJsLoader,
} from '../src/index.js';

const mock = vi.hoisted(() => ({
  loaded: vi.fn(),
  construct: vi.fn(),
  createError: undefined as unknown,
}));

vi.mock('@editorjs/editorjs', () => {
  mock.loaded();
  return {
    default: class {
      readonly isReady = Promise.resolve();
      constructor(options: EditorConfig) {
        if (mock.createError) throw mock.createError;
        mock.construct(options);
      }
    },
  };
});

beforeAll(() =>
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()),
);
beforeEach(() => {
  mock.construct.mockClear();
  mock.createError = undefined;
});
afterEach(() => TestBed.resetTestingModule());

describe('Editor.js loading and ownership', () => {
  it('resolves the default loader on the server without evaluating Editor.js', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const loader = TestBed.inject(EDITOR_JS_LOADER);
    expect(mock.loaded).not.toHaveBeenCalled();
    await expect(loader()).rejects.toThrow('requires a browser platform');
    expect(mock.loaded).not.toHaveBeenCalled();
  });

  it('defers construction and gives each owner its own instance with protected options', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
    const factory = await TestBed.inject(EDITOR_JS_LOADER)();
    expect(mock.loaded).toHaveBeenCalledOnce();
    expect(mock.construct).not.toHaveBeenCalled();
    const holder = {} as HTMLElement;
    const otherHolder = {} as HTMLElement;
    const data = { blocks: [{ type: 'custom', data: { text: 'Initial' } }] };
    const onChange = vi.fn();
    const foreignCallback = vi.fn();
    // Simulate untyped JS or a caller bypassing the public configuration type.
    const config = Object.freeze({
      placeholder: 'Write',
      minHeight: 42,
      holder: 'foreign',
      holderId: 'legacy',
      data: { blocks: [] },
      onReady: foreignCallback,
      onChange: foreignCallback,
    }) as unknown as EditorJsConfig;
    const first = factory({ holder, data, config, onChange });
    const second = factory({ holder: otherHolder, onChange });
    expect(first).not.toBe(second);
    const options: EditorConfig = mock.construct.mock.calls[0][0];
    expect(options).toMatchObject({
      placeholder: 'Write',
      minHeight: 42,
      holder,
      data,
    });
    expect(options.holderId).toBeUndefined();
    expect(options.onReady).toBeUndefined();
    expect(options.onChange).toBe(onChange);
    expect(options.data).not.toBe(data);
    expect(options.data?.blocks[0].data).not.toBe(data.blocks[0].data);
    expect(mock.construct.mock.calls[1][0].holder).toBe(otherHolder);
    expect(mock.construct.mock.calls[1][0].data).toEqual({ blocks: [] });
    onChange();
    expect(foreignCallback).not.toHaveBeenCalled();
    expect(config).toHaveProperty('holder', 'foreign');
  });

  it('rejects invalid documents using core diagnostics before constructing an editor', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
    const factory = await TestBed.inject(EDITOR_JS_LOADER)();
    try {
      factory({
        holder: {} as HTMLElement,
        onChange: vi.fn(),
        data: { blocks: [{ type: '', data: {} }] },
      });
      expect.fail('Expected invalid initial data to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect((error as TypeError).cause).toMatchObject({
        code: 'invalid_type',
        path: ['blocks', 0, 'type'],
      });
    }
    expect(mock.construct).not.toHaveBeenCalled();
  });

  it('propagates constructor failure to the owner', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
    const factory = await TestBed.inject(EDITOR_JS_LOADER)();
    const failure = new Error('Tool construction failed');
    mock.createError = failure;
    expect(() =>
      factory({ holder: {} as HTMLElement, onChange: vi.fn() }),
    ).toThrow(failure);
  });

  it('supports environment overrides without sharing instances or leaking into siblings', async () => {
    const create = vi.fn(
      () => ({ isReady: Promise.resolve() }) as EditorJsInstance,
    );
    const loader: EditorJsLoader = vi.fn(async () => create);
    TestBed.configureTestingModule({
      providers: [provideEditorJsLoader(loader)],
    });
    const parent = TestBed.inject(EDITOR_JS_LOADER);
    const failure = new Error('Download failed');
    const childLoader: EditorJsLoader = async () => {
      throw failure;
    };
    const child = createEnvironmentInjector(
      [provideEditorJsLoader(childLoader)],
      TestBed.inject(EnvironmentInjector),
    );
    try {
      expect(parent).toBe(loader);
      expect(create).not.toHaveBeenCalled();
      await expect(child.get(EDITOR_JS_LOADER)()).rejects.toBe(failure);
      expect(TestBed.inject(EDITOR_JS_LOADER)).toBe(loader);
      const factory = await parent();
      const options = { holder: {} as HTMLElement, onChange: vi.fn() };
      expect(factory(options)).not.toBe(factory(options));
    } finally {
      child.destroy();
    }
  });
});
