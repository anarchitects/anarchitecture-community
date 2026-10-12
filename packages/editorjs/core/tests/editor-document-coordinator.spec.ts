import { describe, expect, it, vi } from 'vitest';
import {
  EditorJsDocumentCoordinator,
  type OutputData,
  type EditorJsChangeEvent,
  type EditorJsErrorEvent,
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
  blocks: [{ type: 'custom', data: { text, nested: { keep: true } } }],
});

function setup() {
  let content = document('Initial');
  const events: EditorJsChangeEvent[] = [];
  const errors: EditorJsErrorEvent[] = [];
  const driver = {
    focus: vi.fn(() => true),
    save: vi.fn(async (): Promise<unknown> => content),
    render: vi.fn(async (data: OutputData) => {
      content = data;
    }),
  };
  const coordinator = new EditorJsDocumentCoordinator({
    driver,
    onChange: (event) => events.push(event),
    onError: (error) => errors.push(error),
  });
  return {
    coordinator,
    driver,
    events,
    errors,
    edit: (data: OutputData) => {
      content = data;
      coordinator.notifyChange();
    },
  };
}

describe('framework-neutral document coordination', () => {
  it('waits for readiness, coalesces notifications and emits detached unknown tool data', async () => {
    const { coordinator, driver, events, edit } = setup();
    coordinator.notifyChange();
    await Promise.resolve();
    expect(driver.save).not.toHaveBeenCalled();
    coordinator.markReady();
    coordinator.markReady();
    const input = document('Latest');
    edit(document('Old'));
    edit(input);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(driver.save).toHaveBeenCalledOnce();
    expect(events[0]).toEqual({ sequence: 2, data: input });
    expect(events[0].data.blocks[0].data).not.toBe(input.blocks[0].data);
    expect(input).toEqual(document('Latest'));
  });

  it('never overlaps saves and discards content superseded while saving', async () => {
    const { coordinator, driver, events, edit } = setup();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    driver.save
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    coordinator.markReady();
    edit(document('Old'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    edit(document('New'));
    edit(document('Newest'));
    expect(driver.save).toHaveBeenCalledOnce();
    first.resolve(document('Old'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    expect(events).toEqual([]);
    second.resolve(document('Newest'));
    await vi.waitFor(() =>
      expect(events).toEqual([{ sequence: 3, data: document('Newest') }]),
    );
  });

  it('serializes detached replacements accepted before readiness and ignores render feedback', async () => {
    const { coordinator, driver, events, edit } = setup();
    const rendered: OutputData[] = [];
    const rendering = deferred<void>();
    driver.render.mockImplementation(async (data) => {
      rendered.push(data);
      coordinator.notifyChange();
      if (rendered.length === 1) await rendering.promise;
    });
    const input = document('One');
    coordinator.replace(input);
    coordinator.replace(document('Two'));
    input.blocks.length = 0;
    expect(driver.render).not.toHaveBeenCalled();
    coordinator.markReady();
    await vi.waitFor(() => expect(driver.render).toHaveBeenCalledOnce());
    coordinator.notifyChange();
    expect(driver.save).not.toHaveBeenCalled();
    rendering.resolve();
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    expect(rendered).toEqual([document('One'), document('Two')]);
    expect(events).toEqual([]);
    edit(document('User edit'));
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('invalidates an in-flight save as soon as a replacement is accepted', async () => {
    const { coordinator, driver, events, edit } = setup();
    const saving = deferred<unknown>();
    driver.save.mockReturnValueOnce(saving.promise);
    coordinator.markReady();
    edit(document('Obsolete'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    coordinator.replace(document('External'));
    expect(driver.render).not.toHaveBeenCalled();
    saving.resolve(document('Obsolete'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    expect(events).toEqual([]);
    // Editor.js can deliver an older batched notification after render settles.
    coordinator.notifyChange();
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(3));
    expect(events).toEqual([]);
    edit(document('New edit'));
    await vi.waitFor(() =>
      expect(events).toEqual([{ sequence: 3, data: document('New edit') }]),
    );
  });

  it('does not loop when a consumer feeds an emitted snapshot back as input', async () => {
    const { coordinator, driver, events, edit } = setup();
    coordinator.markReady();
    edit(document('Edit'));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    coordinator.replace(events[0].data);
    await vi.waitFor(() => expect(driver.render).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    coordinator.notifyChange();
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(3));
    expect(events).toHaveLength(1);
  });

  it('ignores timestamp/key-order-only changes and does not retain mutable event data', async () => {
    const { coordinator, driver, events, edit } = setup();
    coordinator.markReady();
    edit(document('Same'));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    events[0].data.blocks.length = 0;
    edit({
      time: 123,
      blocks: [
        { data: { nested: { keep: true }, text: 'Same' }, type: 'custom' },
      ],
    });
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    expect(events).toHaveLength(1);
    edit({ ...document('Same'), version: 'future' });
    await vi.waitFor(() => expect(events).toHaveLength(2));
  });

  it.each([undefined, { blocks: [] }])(
    'renders missing/empty data deliberately: %j',
    async (data) => {
      const { coordinator, driver, events } = setup();
      coordinator.markReady();
      coordinator.replace(data);
      await vi.waitFor(() =>
        expect(driver.render).toHaveBeenCalledWith({ blocks: [] }),
      );
      expect(events).toEqual([]);
    },
  );

  it.each([
    null,
    '{"blocks":[]}',
    { blocks: [{ type: '', data: {} }] },
    { blocks: [{ type: 'custom', data: { bad: () => 1 } }] },
  ])(
    'rejects invalid input without invalidating an accepted save: %j',
    async (data) => {
      const { coordinator, driver, events, errors, edit } = setup();
      const saving = deferred<unknown>();
      driver.save.mockReturnValueOnce(saving.promise);
      coordinator.markReady();
      edit(document('Valid'));
      await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
      coordinator.replace(data);
      expect(errors[0]).toMatchObject({
        operation: 'data',
        code: 'invalid-data',
        cause: { path: expect.any(Array) },
      });
      saving.resolve(document('Valid'));
      await vi.waitFor(() => expect(events).toHaveLength(1));
      expect(driver.render).not.toHaveBeenCalled();
    },
  );

  it('recovers from rejected and invalid saves on subsequent notifications', async () => {
    const { coordinator, driver, events, errors, edit } = setup();
    const failure = new Error('Save failed');
    driver.save
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ blocks: null });
    coordinator.markReady();
    edit(document('One'));
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(errors[0]).toEqual({
      operation: 'save',
      code: 'operation-failed',
      cause: failure,
    });
    edit(document('Two'));
    await vi.waitFor(() => expect(errors).toHaveLength(2));
    expect(errors[1]).toMatchObject({
      operation: 'save',
      code: 'invalid-data',
      cause: { path: ['blocks'] },
    });
    edit(document('Three'));
    await vi.waitFor(() =>
      expect(events).toEqual([{ sequence: 3, data: document('Three') }]),
    );
  });

  it('continues replacements after render failure and establishes a silent recovery baseline', async () => {
    const { coordinator, driver, events, errors, edit } = setup();
    const failure = new Error('Render failed');
    driver.render.mockRejectedValueOnce(failure);
    coordinator.markReady();
    coordinator.replace(document('Failed'));
    coordinator.replace(document('Recovered'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    expect(errors).toEqual([
      { operation: 'render', code: 'operation-failed', cause: failure },
    ]);
    coordinator.notifyChange();
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    expect(events).toEqual([]);
    edit(document('Edit'));
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('uses the next successful save as a silent baseline after a replacement snapshot fails', async () => {
    const { coordinator, driver, errors, events, edit } = setup();
    driver.save.mockRejectedValueOnce(new Error('Baseline failed'));
    coordinator.markReady();
    coordinator.replace(document('Replacement'));
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    coordinator.notifyChange();
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    expect(events).toEqual([]);
    edit(document('Edit'));
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it.each(['save', 'render'] as const)(
    'disposes pending %s work, cancels queued work and suppresses late failures',
    async (operation) => {
      const { coordinator, driver, events, errors, edit } = setup();
      const pending = deferred<never>();
      if (operation === 'save')
        driver.save.mockReturnValueOnce(pending.promise);
      else driver.render.mockReturnValueOnce(pending.promise);
      coordinator.markReady();
      if (operation === 'save') edit(document('Pending'));
      else coordinator.replace(document('Pending'));
      await vi.waitFor(() => expect(driver[operation]).toHaveBeenCalledOnce());
      coordinator.replace(document('Queued'));
      coordinator.dispose();
      coordinator.dispose();
      coordinator.replace(document('After disposal'));
      coordinator.markReady();
      coordinator.notifyChange();
      pending.reject(new Error('Late failure'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(events).toEqual([]);
      expect(errors).toEqual([]);
      expect(driver.render).toHaveBeenCalledTimes(
        operation === 'render' ? 1 : 0,
      );
      expect(driver.save).toHaveBeenCalledTimes(operation === 'save' ? 1 : 0);
    },
  );

  it('discards a successful save after disposal without affecting another coordinator', async () => {
    const first = setup();
    const second = setup();
    const saving = deferred<unknown>();
    first.driver.save.mockReturnValueOnce(saving.promise);
    first.coordinator.markReady();
    second.coordinator.markReady();
    first.edit(document('First'));
    await vi.waitFor(() => expect(first.driver.save).toHaveBeenCalledOnce());
    first.coordinator.dispose();
    saving.resolve(document('First'));
    second.edit(document('Second'));
    await vi.waitFor(() => expect(second.events).toHaveLength(1));
    expect(first.events).toEqual([]);
  });
});

describe('authoritative invalidation', () => {
  it('suspends publications between invalidation and reconciliation, including an in-flight save', async () => {
    const { coordinator, driver, events, edit } = setup();
    const saving = deferred<unknown>();
    driver.save.mockReturnValueOnce(saving.promise);
    coordinator.markReady();
    edit(document('Obsolete'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    coordinator.invalidate();
    saving.resolve(document('Obsolete'));
    await coordinator.api.focus();
    edit(document('Also obsolete'));
    expect(driver.save).toHaveBeenCalledOnce();
    expect(events).toEqual([]);
    coordinator.replace(document('Authoritative'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    edit(document('New edit'));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].data).toEqual(document('New edit'));
  });

  it('does not let a queued earlier replacement release a later invalidation', async () => {
    const { coordinator, driver, events, edit } = setup();
    coordinator.replace(document('Queued before ready'));
    coordinator.invalidate();
    coordinator.markReady();
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    edit(document('Obsolete after queued render'));
    await coordinator.api.focus();
    expect(events).toEqual([]);
    expect(driver.save).toHaveBeenCalledOnce();
    coordinator.replace(document('Reset'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    edit(document('Accepted'));
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('keeps a failed replacement authoritative until an explicit successful retry', async () => {
    const { coordinator, driver, events, errors, edit } = setup();
    driver.render.mockRejectedValueOnce(new Error('Partial render'));
    coordinator.markReady();
    coordinator.replace(document('Requested'));
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    edit(document('Partial content'));
    edit(document('More partial content'));
    expect(events).toEqual([]);
    expect(driver.save).not.toHaveBeenCalled();
    await expect(coordinator.api.save()).rejects.toMatchObject({
      code: 'superseded',
    });
    coordinator.replace(document('Requested'));
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    edit(document('Recovered edit'));
    await vi.waitFor(() => expect(events).toHaveLength(1));
  });

  it('rejects an in-flight explicit snapshot invalidated by reset exactly once and permits retry', async () => {
    const { coordinator, driver, errors } = setup();
    const saving = deferred<unknown>();
    driver.save.mockReturnValueOnce(saving.promise);
    coordinator.markReady();
    const result = coordinator.api.save().catch((error: unknown) => error);
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledOnce());
    coordinator.invalidate();
    coordinator.replace(document('Reset'));
    saving.resolve(document('Obsolete'));
    const failure = await result;
    expect(failure).toMatchObject({ operation: 'save', code: 'superseded' });
    expect(errors).toEqual([failure]);
    await vi.waitFor(() => expect(driver.save).toHaveBeenCalledTimes(2));
    expect(await coordinator.api.save()).toEqual(document('Reset'));
  });
});
