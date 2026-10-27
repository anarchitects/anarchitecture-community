import { defineConfig } from '@playwright/test';
import packed from './packed.config.mts';
export default defineConfig({ ...packed, testDir: './portable', workers: 1 });
