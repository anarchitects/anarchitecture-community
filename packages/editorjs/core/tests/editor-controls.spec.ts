import { describe, expect, it, vi } from 'vitest';
import {
  EditorJsDocumentCoordinator,
  EditorJsOperationError,
  type EditorJsChangeEvent,
  type EditorJsErrorEvent,
  type OutputData,
} from '../src/index.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const document = (text: string): OutputData => ({
  blocks: [{ type: 'custom', data: { text } }],
});
function owner() {
  let content = document('Initial');
  const changes: EditorJsChangeEvent[] = [];
  const errors: EditorJsErrorEvent[] = [];
  const calls: string[] = [];
  const driver = {
    save: vi.fn(async () => {
      calls.push('save');
      return content;
    }),
    render: vi.fn(async (data: OutputData) => {
      calls.push('render');
      content = data;
      coordinator.notifyChange();
    }),
    clear: vi.fn(() => {
      calls.push('clear');
      content = { blocks: [] };
      coordinator.notifyChange();
    }),
    focus: vi.fn((atEnd?: boolean) => {
      calls.push(`focus:${atEnd}`);
      return false;
    }),
    setReadOnly: vi.fn(async (value: boolean) => {
      calls.push(`readOnly:${value}`);
      coordinator.notifyChange();
      return value;
    }),
  };
  const coordinator = new EditorJsDocumentCoordinator({
    driver,
    onChange: (event) => changes.push(event),
    onError: (error) => errors.push(error),
  });
  return {
    coordinator,
    api: coordinator.api,
    driver,
    changes,
    errors,
    calls,
    edit: (data: OutputData) => {
      content = data;
      coordinator.notifyChange();
    },
  };
}

const operations = ['save', 'render', 'clear', 'focus', 'setReadOnly'] as const;
function invoke(
  api: ReturnType<typeof owner>['api'],
  operation: (typeof operations)[number],
) {
  switch (operation) {
    case 'save':
      return api.save();
    case 'render':
      return api.render(document('Replacement'));
    case 'clear':
      return api.clear();
    case 'focus':
      return api.focus(true);
    case 'setReadOnly':
      return api.setReadOnly(true);
  }
}

describe('instance-scoped core controls', () => {
  it.each(operations)(
    'rejects %s before readiness and after disposal without invoking the driver',
    async (operation) => {
      const { coordinator, api, errors, calls } = owner();
      const failure = await invoke(api, operation).catch(
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(EditorJsOperationError);
      expect(failure).toMatchObject({
        code: 'not-ready',
        operation: operation === 'setReadOnly' ? 'readOnly' : operation,
      });
      expect(errors).toEqual([failure]);
      coordinator.dispose();
      coordinator.markReady();
      await expect(invoke(api, operation)).rejects.toMatchObject({
        code: 'destroyed',
      });
      expect(errors).toHaveLength(1);
      expect(calls).toEqual([]);
    },
  );

  it('serializes all controls and input replacements in acceptance order', async () => {
    const { coordinator, api, driver, calls, changes } = owner();
    coordinator.markReady();
    const input = document('API');
    const render = api.render(input);
    input.blocks.length = 0;
    const saved = api.save();
    coordinator.replace(document('Input'));
    const focus = api.focus(true);
    const clear = api.clear();
    const mode = api.setReadOnly(true);
    const result = await Promise.all([render, saved, focus, clear, mode]);
    expect(result).toEqual([
      undefined,
      document('API'),
      false,
      undefined,
      true,
    ]);
    expect(driver.render.mock.calls.map(([data]) => data)).toEqual([
      document('API'),
      document('Input'),
    ]);
    expect(calls).toEqual([
      'render',
      'save',
      'save',
      'render',
      'save',
      'focus:true',
      'clear',
      'save',
      'save',
      'readOnly:true',
    ]);
    expect(changes).toEqual([]);
    coordinator.notifyChange();
    await api.focus(); // Wait behind the queued automatic save.
    expect(changes).toEqual([]);
  });

  it('returns a detached saved document without emitting a change or altering the baseline', async () => {
    const { coordinator, api, changes } = owner();
    coordinator.markReady();
    const saved = await api.save();
    saved.blocks.length = 0;
    expect(await api.save()).toEqual(document('Initial'));
    expect(changes).toEqual([]);
    const { save, focus } = api;
    expect(Object.isFrozen(api)).toBe(true);
    expect(await save()).toEqual(document('Initial'));
    expect(await focus()).toBe(false);
  });

  it('waits behind an in-flight save and suppresses its stale event when render is accepted', async () => {
    const { coordinator, api, driver, changes, edit } = owner();
    const pending = deferred<OutputData>();
    driver.save.mockReturnValueOnce(pending.promise);
    coordinator.markReady();
    edit(document('Old'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    const render = api.render(document('External'));
    expect(driver.render).not.toHaveBeenCalled();
    pending.resolve(document('Old'));
    await render;
    expect(changes).toEqual([]);
    edit(document('New'));
    await api.focus();
    expect(changes).toEqual([{ data: document('New'), sequence: 2 }]);
  });

  it('preserves pending edits across read-only transitions without emitting mode feedback', async () => {
    const { coordinator, api, driver, changes, edit } = owner();
    const saving = deferred<OutputData>();
    driver.save.mockReturnValueOnce(saving.promise);
    coordinator.markReady();
    edit(document('First'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    const mode = api.setReadOnly(true);
    edit(document('Latest'));
    saving.resolve(document('First'));
    expect(await mode).toBe(true);
    await api.focus();
    expect(changes).toEqual([{ data: document('Latest'), sequence: 2 }]);
    expect(await api.setReadOnly(false)).toBe(false);
    coordinator.notifyChange();
    await api.focus();
    expect(changes).toHaveLength(1);
  });

  it('does not emit a change for a read-only toggle before any editor notification', async () => {
    const { coordinator, api, changes } = owner();
    coordinator.markReady();
    await api.setReadOnly(true);
    coordinator.notifyChange();
    await api.focus();
    expect(changes).toEqual([]);
  });

  it.each(operations)(
    'reports the same %s failure to its caller and error sink, then continues the queue',
    async (operation) => {
      const { coordinator, api, driver, errors } = owner();
      const cause = new Error('Driver failed');
      if (operation === 'focus' || operation === 'clear')
        driver[operation].mockImplementationOnce(() => {
          throw cause;
        });
      else driver[operation].mockRejectedValueOnce(cause);
      coordinator.markReady();
      const result = invoke(api, operation).catch((error: unknown) => error);
      const following = api.save();
      const failure = await result;
      expect(failure).toBeInstanceOf(EditorJsOperationError);
      expect(failure).toMatchObject({
        operation: operation === 'setReadOnly' ? 'readOnly' : operation,
        code: 'operation-failed',
        cause,
      });
      expect(errors[0]).toBe(failure);
      await expect(following).resolves.toEqual(document('Initial'));
    },
  );

  it('rejects invalid render data without invalidating a pending editor save', async () => {
    const { coordinator, api, driver, changes, errors, edit } = owner();
    const saving = deferred<OutputData>();
    driver.save.mockReturnValueOnce(saving.promise);
    coordinator.markReady();
    edit(document('Valid'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    await expect(
      api.render(null as unknown as OutputData),
    ).rejects.toMatchObject({
      operation: 'render',
      code: 'invalid-data',
      cause: { path: [] },
    });
    saving.resolve(document('Valid'));
    await api.focus();
    expect(changes).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(driver.render).not.toHaveBeenCalled();
  });

  it('rejects invalid saved data and a failed write baseline with the save diagnostic', async () => {
    const { coordinator, api, driver, errors } = owner();
    coordinator.markReady();
    driver.save.mockResolvedValueOnce(null as unknown as OutputData);
    await expect(api.save()).rejects.toMatchObject({
      operation: 'save',
      code: 'invalid-data',
    });
    const cause = new Error('Baseline failed');
    driver.save.mockRejectedValueOnce(cause);
    await expect(api.render(document('Written'))).rejects.toMatchObject({
      operation: 'save',
      code: 'operation-failed',
      cause,
    });
    expect(errors).toHaveLength(2);
    expect(await api.save()).toEqual(document('Written'));
  });

  it.each(['resolve', 'reject'] as const)(
    'rejects active and queued commands immediately on disposal, regardless of later upstream %s',
    async (settlement) => {
      const { coordinator, api, driver, errors, changes } = owner();
      const saving = deferred<OutputData>();
      driver.save.mockReturnValueOnce(saving.promise);
      coordinator.markReady();
      const active = api.save().catch((error: unknown) => error);
      const queued = api
        .render(document('Never rendered'))
        .catch((error: unknown) => error);
      await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
      coordinator.dispose();
      expect(await active).toMatchObject({
        operation: 'save',
        code: 'destroyed',
      });
      expect(await queued).toMatchObject({
        operation: 'render',
        code: 'destroyed',
      });
      if (settlement === 'resolve') saving.resolve(document('Late'));
      else saving.reject(new Error('Late'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(driver.render).not.toHaveBeenCalled();
      expect(errors).toEqual([]);
      expect(changes).toEqual([]);
    },
  );

  it('binds independent facades to independent lifetimes', async () => {
    const first = owner();
    const second = owner();
    first.coordinator.markReady();
    second.coordinator.markReady();
    await first.api.render(document('First'));
    await second.api.render(document('Second'));
    first.coordinator.dispose();
    await expect(first.api.save()).rejects.toMatchObject({ code: 'destroyed' });
    expect(await second.api.save()).toEqual(document('Second'));
    expect(first.api).not.toBe(second.api);
  });

  it('reports absent optional driver capabilities without disabling document operations', async () => {
    const errors: EditorJsErrorEvent[] = [];
    const coordinator = new EditorJsDocumentCoordinator({
      driver: {
        save: async () => document('Supported'),
        render: async () => undefined,
      },
      onChange: () => undefined,
      onError: (error) => errors.push(error),
    });
    coordinator.markReady();
    await expect(coordinator.api.clear()).rejects.toMatchObject({
      operation: 'clear',
      code: 'operation-failed',
    });
    await expect(coordinator.api.focus()).rejects.toMatchObject({
      operation: 'focus',
      code: 'operation-failed',
    });
    await expect(coordinator.api.setReadOnly(true)).rejects.toMatchObject({
      operation: 'readOnly',
      code: 'operation-failed',
    });
    expect(await coordinator.api.save()).toEqual(document('Supported'));
    expect(errors).toHaveLength(3);
  });
});

describe('read-only driver boundaries', () => {
  it('supports initially read-only owners and defers write baselines until editing resumes', async () => {
    let readOnly = true;
    let data = document('Initial');
    const changes: EditorJsChangeEvent[] = [];
    const save = vi.fn(async () => {
      if (readOnly) throw new Error('Cannot save read-only');
      return data;
    });
    const coordinator = new EditorJsDocumentCoordinator({
      driver: {
        save,
        render: async (value) => {
          data = value;
        },
        setReadOnly: async (value) => {
          readOnly = value;
          return value;
        },
        getReadOnly: () => readOnly,
      },
      onChange: (event) => changes.push(event),
      onError: () => undefined,
    });
    coordinator.markReady(true);
    await coordinator.api.render(document('Replacement'));
    expect(save).not.toHaveBeenCalled();
    await expect(coordinator.api.save()).rejects.toMatchObject({
      operation: 'save',
      code: 'operation-failed',
    });
    expect(await coordinator.api.setReadOnly(false)).toBe(false);
    expect(changes).toEqual([]);
    expect(await coordinator.api.save()).toEqual(document('Replacement'));
  });

  it('uses actual driver state to recover after a partially failed read-only transition', async () => {
    let readOnly = false;
    let fail = true;
    const error = new Error('Failed after mode changed');
    const coordinator = new EditorJsDocumentCoordinator({
      driver: {
        save: async () => {
          if (readOnly) throw new Error('Cannot save read-only');
          return document('Content');
        },
        render: async () => undefined,
        setReadOnly: async (value) => {
          readOnly = value;
          if (fail) {
            fail = false;
            throw error;
          }
          return value;
        },
        getReadOnly: () => readOnly,
      },
      onChange: () => undefined,
      onError: () => undefined,
    });
    coordinator.markReady();
    await expect(coordinator.api.setReadOnly(true)).rejects.toMatchObject({
      operation: 'readOnly',
      cause: error,
    });
    expect(await coordinator.api.setReadOnly(false)).toBe(false);
    expect(await coordinator.api.save()).toEqual(document('Content'));
  });
});
