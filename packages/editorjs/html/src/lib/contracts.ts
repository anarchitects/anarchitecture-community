/** Resource ceilings may be lowered, never raised above the package defaults. */
export interface HtmlRenderLimits {
  readonly maxInputBytes?: number;
  readonly maxBlocks?: number;
  readonly maxDepth?: number;
  readonly maxStringBytes?: number;
  readonly maxOutputBytes?: number;
  readonly maxDiagnostics?: number;
}

/** Host-owned link policy. This does not perform network requests. */
export interface HtmlUrlPolicy {
  readonly allowRelative?: boolean;
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
}

export interface HtmlRendererOptions {
  readonly mode?: 'strict' | 'preview';
  readonly limits?: HtmlRenderLimits;
  readonly urls?: HtmlUrlPolicy;
  readonly classes?: HtmlClasses;
}

export type HtmlDiagnosticCode =
  | 'invalid_configuration'
  | 'invalid_document'
  | 'invalid_block_data'
  | 'unknown_block'
  | 'unknown_tune'
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
