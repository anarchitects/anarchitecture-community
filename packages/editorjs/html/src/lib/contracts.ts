/** Resource ceilings may be lowered, never raised above the package defaults. */
export interface HtmlRenderLimits {
  readonly maxInputBytes?: number;
  readonly maxBlocks?: number;
  readonly maxDepth?: number;
  readonly maxListDepth?: number;
  readonly maxStringBytes?: number;
  readonly maxOutputBytes?: number;
  readonly maxDiagnostics?: number;
}

/** Host-owned link policy. This does not perform network requests. */
export interface HtmlUrlPolicy {
  readonly allowRelative?: boolean;
  /** Relative image sources require explicit opt-in; mailto never applies to images. */
  readonly allowRelativeImages?: boolean;
  readonly allowMailto?: boolean;
  readonly httpsOnly?: boolean;
  /** Exact http(s) origins; relative links retain the host's base-URL meaning. */
  readonly allowedOrigins?: readonly string[];
}

/** Classes come from trusted configuration, never saved HTML attributes. */
export interface HtmlClasses {
  readonly paragraph?: readonly string[];
  readonly heading?: readonly string[];
  readonly quote?: readonly string[];
  readonly quoteLeft?: readonly string[];
  readonly quoteCenter?: readonly string[];
  readonly quoteCaption?: readonly string[];
  readonly list?: readonly string[];
  readonly listItem?: readonly string[];
  readonly checklist?: readonly string[];
  readonly image?: readonly string[];
  readonly imageCaption?: readonly string[];
  readonly imageBorder?: readonly string[];
  readonly imageBackground?: readonly string[];
  readonly imageStretched?: readonly string[];
  /** Permitted tokens for custom callback output. */
  readonly custom?: readonly string[];
}

export type HtmlReadonly<T> = T extends object
  ? { readonly [K in keyof T]: HtmlReadonly<T[K]> }
  : T;

/** A host guard validates unknown persisted data before its typed callback runs. */
export type HtmlDataGuard<Data> = (data: unknown) => data is Data;

export type HtmlReadonlyJson =
  | null
  | boolean
  | number
  | string
  | readonly HtmlReadonlyJson[]
  | { readonly [key: string]: HtmlReadonlyJson };

export interface HtmlRenderContext {
  readonly blockIndex: number;
  readonly block: {
    readonly type: string;
    readonly id?: string;
    readonly data: HtmlReadonlyJson;
    readonly tunes?: { readonly [name: string]: HtmlReadonlyJson };
  };
  /** Escapes literal text/attribute values; never interprets markup. */
  readonly escapeText: (text: string) => string;
  /** Sanitizes permitted inline markup and records rejected content. */
  readonly inline: (html: string) => string;
}

export type HtmlStandardProfile =
  | 'paragraph'
  | 'header'
  | 'quote'
  | 'list'
  | 'image';
export interface HtmlProfileRegistration {
  readonly name: string;
  readonly profile: HtmlStandardProfile;
  readonly override?: boolean;
}
export interface HtmlBlockRegistration<
  Name extends string = string,
  Data = unknown,
> {
  readonly name: Name;
  readonly override?: boolean;
  readonly validate: HtmlDataGuard<Data>;
  readonly render: (
    data: HtmlReadonly<Data>,
    context: HtmlRenderContext,
  ) => string;
}
export type HtmlTuneRegistration<
  Name extends string = string,
  Data = unknown,
> = {
  readonly name: Name;
  readonly validate: HtmlDataGuard<Data>;
} & (
  | { readonly ignore: true; readonly render?: never }
  | {
      readonly ignore?: false;
      readonly render: (
        html: string,
        data: HtmlReadonly<Data>,
        context: HtmlRenderContext,
      ) => string;
    }
);
export type HtmlBlockRegistrations<DataMap extends object> = {
  [Name in keyof DataMap & string]: HtmlBlockRegistration<Name, DataMap[Name]>;
}[keyof DataMap & string];
export type HtmlTuneRegistrations<DataMap extends object> = {
  [Name in keyof DataMap & string]: HtmlTuneRegistration<Name, DataMap[Name]>;
}[keyof DataMap & string];

export interface HtmlRendererOptions<
  Blocks extends object = Record<string, unknown>,
  Tunes extends object = Record<string, unknown>,
> {
  readonly mode?: 'strict' | 'preview';
  readonly limits?: HtmlRenderLimits;
  readonly urls?: HtmlUrlPolicy;
  readonly classes?: HtmlClasses;
  /** Explicit aliases of immutable built-in profiles. */
  readonly profiles?: readonly HtmlProfileRegistration[];
  readonly blocks?: readonly HtmlBlockRegistrations<Blocks>[];
  /** Applied in registration order, independently of saved tune-key order. */
  readonly tunes?: readonly HtmlTuneRegistrations<Tunes>[];
}

export type HtmlDiagnosticCode =
  | 'invalid_configuration'
  | 'invalid_document'
  | 'invalid_block_data'
  | 'unknown_block'
  | 'unknown_tune'
  | 'invalid_tune_data'
  | 'missing_alt'
  | 'callback_failed'
  | 'unsafe_html'
  | 'limit_exceeded'
  | 'diagnostics_truncated'
  | 'render_failed';

export interface HtmlDiagnostic {
  readonly code: HtmlDiagnosticCode;
  readonly stage:
    | 'configuration'
    | 'structure'
    | 'profile'
    | 'safety'
    | 'limits';
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly blockIndex?: number;
  readonly id?: string;
  readonly type?: string;
  readonly tune?: string;
}

/** Only strict success is complete output; failure deliberately has no HTML. */
export type HtmlRenderResult =
  | {
      readonly status: 'success';
      readonly html: string;
      readonly diagnostics: readonly HtmlDiagnostic[];
    }
  | {
      readonly status: 'preview';
      readonly html: string;
      readonly diagnostics: readonly HtmlDiagnostic[];
    }
  | {
      readonly status: 'failure';
      readonly diagnostics: readonly HtmlDiagnostic[];
    };

export interface EditorJsHtmlRenderer {
  render(input: unknown): HtmlRenderResult;
}
