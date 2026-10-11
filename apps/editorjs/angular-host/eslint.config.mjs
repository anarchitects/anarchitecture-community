import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  // The Yarn link targets dist/APF, which Nx's import locator misidentifies as
  // an app. Allow only this public artifact import; project.json declares the
  // real library dependency. Keep every other module-boundary constraint.
  ...baseConfig.map((config) => {
    const boundary = config.rules?.['@nx/enforce-module-boundaries'];
    if (!Array.isArray(boundary)) return config;
    return {
      ...config,
      rules: {
        ...config.rules,
        '@nx/enforce-module-boundaries': [
          boundary[0],
          {
            ...boundary[1],
            allow: [...boundary[1].allow, '@anarchitects/editorjs-angular'],
          },
        ],
      },
    };
  }),
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'aa',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'aa',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
