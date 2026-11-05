import { readmeExamples } from '../../html/tools/readme-examples.mjs';

export const angularRecipes = [
  'article.component.ts',
  'preview.component.ts',
  'directive-article.component.ts',
  'scoped-article.component.ts',
  'article.routes.ts',
  'main.ts',
  'main.server.ts',
];

export const angularReadmeExamples = (readme) =>
  readmeExamples(readme, angularRecipes);
