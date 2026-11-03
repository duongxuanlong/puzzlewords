#!/usr/bin/env node
/**
 * Level save server for the level editor scene (ADR-0008). The editor runs in a browser and cannot
 * write files, so its Save button POSTs the level JSON here and this writes it to
 * assets/resources/levels/level_NNN.json after validating it with the same LevelSchema the game uses.
 * Creator notices the new file and imports it; the game then lists it (levels are discovered by
 * folder, see ui/GameAssets.loadLevels). Development only: binds to localhost.
 *
 * Usage: npm run editor:server          (port 7457; override with LEVEL_SERVER_PORT)
 *   POST /levels   body: level JSON  → 200 { file } | 400 { errors }
 *   GET  /levels                     → 200 [ { file, id, topic, words } ]
 */
'use strict';
require('./module-paths');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { validateLevel } = require('LevelSchema');

const PORT = Number(process.env.LEVEL_SERVER_PORT || 7457);
const DIR = path.join(__dirname, '..', 'assets', 'resources', 'levels');
const MAX_BODY = 1 << 20;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, CORS));
  res.end(JSON.stringify(body));
}

function fileName(id) {
  return 'level_' + String(id).padStart(3, '0') + '.json';
}

function list() {
  return fs
    .readdirSync(DIR)
    .filter((f) => /^level_\d{3}\.json$/.test(f))
    .sort()
    .map((file) => {
      const level = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
      return { file, id: level.id, topic: level.topic, words: level.words };
    });
}

function save(level) {
  const errors = validateLevel(level);
  if (errors.length) {
    return { status: 400, body: { errors } };
  }
  const file = fileName(level.id);
  fs.writeFileSync(path.join(DIR, file), JSON.stringify(level, null, 2) + '\n');
  console.log('saved ' + file + ' (' + level.topic + ': ' + level.words.join(', ') + ')');
  return { status: 200, body: { file } };
}

http
  .createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    if (url !== '/levels') {
      send(res, 404, { error: 'unknown route' });
      return;
    }
    if (req.method === 'GET') {
      send(res, 200, list());
      return;
    }
    if (req.method !== 'POST') {
      send(res, 405, { error: 'method not allowed' });
      return;
    }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) {
        req.destroy();
      }
    });
    req.on('end', () => {
      let level;
      try {
        level = JSON.parse(raw);
      } catch (_e) {
        send(res, 400, { errors: ['body is not JSON'] });
        return;
      }
      const result = save(level);
      send(res, result.status, result.body);
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log('Level save server: http://localhost:' + PORT + '/levels → ' + path.relative(process.cwd(), DIR)));
