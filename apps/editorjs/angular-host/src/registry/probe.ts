/** Browser-owned fixture instrumentation, never allocated during SSR. */
export interface RegistryProbe {
  evaluated: string[];
  loads: string[];
  created: number;
  destroyed: number;
  blockCreated: number;
  blockDestroyed: number;
  uploadStarted?: number;
  uploadFinished?: number;
  holdUpload?: boolean;
  releaseUpload?: () => void;
  failNext?: boolean;
  holdNext?: boolean;
  release?: () => void;
}
declare global {
  interface Window {
    registryProbe?: RegistryProbe;
  }
}
export function probe(): RegistryProbe {
  return (window.registryProbe ??= {
    evaluated: [],
    loads: [],
    created: 0,
    destroyed: 0,
    blockCreated: 0,
    blockDestroyed: 0,
  });
}
export function evaluated(name: string): void {
  // Deliberately browser-only: a server import must fail, even without a guard.
  document.createElement('span');
  probe().evaluated.push(name);
}
export async function loading(name: string): Promise<void> {
  const state = probe();
  state.loads.push(name);
  if (name !== 'card' && name !== 'common-paragraph') return;
  if (state.holdNext) {
    state.holdNext = false;
    await new Promise<void>((resolve) => {
      state.release = resolve;
    });
    state.release = undefined;
  }
  if (state.failNext) {
    state.failNext = false;
    throw new Error('Fixture lazy tool rejection');
  }
}
