#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const ROOT = process.cwd();
const decoder = new TextDecoder('utf-8', { fatal: true });
const TEXT_EXTENSIONS = new Set(['.js', '.html', '.css', '.json', '.md']);
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '.run'
]);

const MOJIBAKE_RE = /\uFFFD|\u00C3|\u00C2/;
const QUESTION_IN_WORD_RE = /[A-Za-zÀ-ÿ]\?[A-Za-zÀ-ÿ]/g;
const QUESTION_FALSE_POSITIVES = [
  '?mes=',
  '?ano=',
  '?id=',
  '?payment_id=',
  '?paymentId=',
  '?next='
];

let issues = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(full);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

    inspectFile(full, rel);
  }
}

function report(rel, message) {
  issues += 1;
  console.error(`${rel}: ${message}`);
}

function inspectFile(full, rel) {
  const buffer = fs.readFileSync(full);
  let text;

  try {
    text = decoder.decode(buffer);
  } catch (_) {
    report(rel, 'arquivo não está em UTF-8 válido');
    return;
  }

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (MOJIBAKE_RE.test(line)) {
      report(rel, `linha ${i + 1}: possível mojibake (${line.trim().slice(0, 120)})`);
    }

    QUESTION_IN_WORD_RE.lastIndex = 0;
    let match;
    while ((match = QUESTION_IN_WORD_RE.exec(line)) !== null) {
      const idx = match.index;
      const snippet = line.slice(Math.max(0, idx - 30), Math.min(line.length, idx + 50));
      const hasFalsePositive = QUESTION_FALSE_POSITIVES.some(token => snippet.includes(token));
      if (hasFalsePositive) continue;
      report(rel, `linha ${i + 1}: '?' suspeito no meio da palavra (${snippet.trim()})`);
    }
  }
}

try {
  walk(ROOT);
  if (issues > 0) {
    console.error(`\nForam encontrados ${issues} problema(s) potencial(is).`);
    process.exitCode = 1;
  } else {
    console.log('OK: nenhum sinal de texto corrompido encontrado.');
  }
} catch (error) {
  console.error('Falha ao verificar arquivos:', error && error.message ? error.message : error);
  process.exitCode = 2;
}
