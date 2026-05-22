export type GovernanceExtensionDiagnosticSeverity =
  | 'notice'
  | 'warning'
  | 'error';

export type GovernanceExtensionDiagnosticCode =
  | 'governance.extension.loaded'
  | 'governance.extension.skipped_optional_missing'
  | 'governance.extension.missing_required'
  | 'governance.extension.invalid_definition'
  | 'governance.extension.duplicate_id'
  | 'governance.extension.registration_failed'
  | 'governance.extension.legacy_probing_used'
  | 'governance.extension.legacy_entrypoint_missing';

export interface GovernanceExtensionDiagnostic {
  code: GovernanceExtensionDiagnosticCode;
  severity: GovernanceExtensionDiagnosticSeverity;
  message: string;
  packageName?: string;
  moduleSpecifier?: string;
  extensionId?: string;
  legacy?: boolean;
}
