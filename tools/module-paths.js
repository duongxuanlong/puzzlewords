// Lets tools require game modules by bare name (require('Solver')), the way Creator and `npm test`
// resolve them, without the caller setting NODE_PATH. Require this first in any tool that needs it.
'use strict';
const path = require('path');
const Module = require('module');

const scripts = path.join(__dirname, '..', 'assets', 'scripts');
const extra = ['model', 'data', 'systems'].map((dir) => path.join(scripts, dir));
process.env.NODE_PATH = [...extra, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();
