/** File atoms share immutable consumer snapshots and separately cached builds. */
export const packedPhases = {
  portable: [],
  interop: [],
  'build-csr': [],
  'csr-editor': ['build-csr'],
  'csr-forms': ['build-csr'],
  'csr-upload': ['build-csr'],
  'csr-forms-upload': ['build-csr'],
  'build-ssr-production': [],
  'build-ssr-diagnostic': [],
  'build-ssr-full': [],
  'build-ssr-eager-control': [],
  ssr: ['build-ssr-production'],
  'hydration-common': [
    'build-ssr-production',
    'build-ssr-diagnostic',
    'build-ssr-full',
  ],
  'hydration-registry': [
    'build-ssr-production',
    'build-ssr-diagnostic',
    'build-ssr-full',
  ],
  'hydration-standalone': [
    'build-ssr-production',
    'build-ssr-diagnostic',
    'build-ssr-full',
  ],
  'hydration-forms': [
    'build-ssr-production',
    'build-ssr-diagnostic',
    'build-ssr-full',
  ],
  'hydration-forms-upload': [
    'build-ssr-production',
    'build-ssr-diagnostic',
    'build-ssr-full',
  ],
  'hydration-upload': [
    'build-ssr-production',
    'build-ssr-diagnostic',
    'build-ssr-full',
  ],
  'hydration-deferred': [
    'build-ssr-production',
    'build-ssr-diagnostic',
    'build-ssr-full',
  ],
  'hydration-forms-deferred': [
    'build-ssr-production',
    'build-ssr-diagnostic',
    'build-ssr-full',
  ],
  isolation: ['build-ssr-production', 'build-ssr-eager-control'],
  'readme-default': [],
  'readme-full': [],
};
export const phasesFor = (mode) =>
  Object.keys(packedPhases).filter(
    (phase) =>
      (mode === 'ssr' && phase !== 'portable') ||
      ([
        'portable',
        'interop',
        'build-csr',
        'csr-editor',
        'csr-forms',
        'csr-upload',
        'csr-forms-upload',
      ].includes(phase) &&
        mode === 'csr'),
  );
export const targetFor = (mode, cell, phase) =>
  `packed-${mode}-${cell}-${phase}`;
export function parallelism(value = '2') {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 8)
    throw new Error('Packed phase parallelism must be an integer from 1 to 8');
  return Number(value);
}
