/** Private fixture diagnostics, passed per request; never placed in TransferState. */
export interface RequestContext {
  delay: number;
  owners: number;
  destroyed: number;
  loaders: number;
  loadersDestroyed: number;
  calls: number;
  instances: number;
  errors: number;
  onOwned: () => void;
  onDisposed: () => void;
}
