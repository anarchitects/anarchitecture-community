#!/usr/bin/env node

import { runAgovCli } from '../agov.js';

process.exitCode = await runAgovCli(process.argv.slice(2));
