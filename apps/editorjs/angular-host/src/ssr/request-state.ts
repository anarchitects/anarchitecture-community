import { isPlatformServer } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  REQUEST,
  REQUEST_CONTEXT,
  PendingTasks,
  TransferState,
  inject,
  makeStateKey,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { OutputData } from '@anarchitects/editorjs-core';
import type { RequestContext } from './request-context';

interface InitialState {
  marker: string;
  document: OutputData;
  disabled: boolean;
  readonly: boolean;
}

const key = makeStateKey<InitialState>('editorjs-fixture-document');

/** A new component provider for each rendered owner, including each SSR request. */
@Injectable()
export class RequestState {
  readonly context = inject(REQUEST_CONTEXT, {
    optional: true,
  }) as RequestContext | null;
  readonly initial: InitialState;

  constructor() {
    const transfer = inject(TransferState);
    const server = isPlatformServer(inject(PLATFORM_ID));
    const request = inject(REQUEST, { optional: true });
    const route = inject(ActivatedRoute).snapshot;
    // Fixed prerender samples must ignore request query parameters even when served over HTTP.
    const sample = route.data['sample'] === true;
    const params = request
      ? new URL(request.url).searchParams
      : new URLSearchParams();
    const candidate = sample
      ? 'public-sample'
      : (params.get('marker') ??
        route.queryParamMap.get('marker') ??
        'public-default');
    const marker = /^[a-zA-Z0-9_-]{1,48}$/.test(candidate)
      ? candidate
      : 'public-default';
    const initial: InitialState = {
      marker,
      document: {
        blocks: [
          {
            id: 'fixture-paragraph',
            type: 'paragraph',
            data: {
              text: `${marker} </script><b>safe & " ' \u2028</b>`,
            },
          },
        ],
      },
      disabled:
        !sample &&
        (params.get('disabled') ?? route.queryParamMap.get('disabled')) ===
          'true',
      readonly:
        !sample &&
        (params.get('readonly') ?? route.queryParamMap.get('readonly')) ===
          'true',
    };
    this.initial = structuredClone(transfer.get(key, initial));
    if (server) transfer.set(key, structuredClone(this.initial));
    else transfer.remove(key);

    const context = this.context;
    if (context) {
      context.owners++;
      context.onOwned();
      inject(DestroyRef).onDestroy(() => {
        context.destroyed++;
        context.onDisposed();
      });
      // Test-only overlap window; this never controls browser activation/hydration.
      if (context.delay) {
        inject(PendingTasks).run(
          () =>
            new Promise<void>((resolve) => setTimeout(resolve, context.delay)),
        );
      }
    }
  }
}
