import test from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS, LogLevelFilter, normalizeLevel } from '../src/index.js';

test('normalizeLevel accepts canonical names case-insensitively', () => {
  assert.equal(normalizeLevel('info'), LEVELS.info);
  assert.equal(normalizeLevel('INFO'), LEVELS.info);
  assert.equal(normalizeLevel('WaRn'), LEVELS.warn);
});

test('normalizeLevel accepts exact numeric ranks', () => {
  assert.equal(normalizeLevel(LEVELS.trace), LEVELS.trace);
  assert.equal(normalizeLevel(LEVELS.fatal), LEVELS.fatal);
});

test('normalizeLevel rejects unknown names and numbers', () => {
  assert.throws(() => normalizeLevel('warning'), TypeError);
  assert.throws(() => normalizeLevel(999), TypeError);
  assert.throws(() => normalizeLevel(null), TypeError);
  assert.throws(() => normalizeLevel({}), TypeError);
});

test('default threshold is info', () => {
  const filter = new LogLevelFilter();
  assert.equal(filter.getThreshold(''), LEVELS.info);
  assert.equal(filter.getThreshold('anything.at.all'), LEVELS.info);
  assert.equal(filter.allows('', 'info'), true);
  assert.equal(filter.allows('', 'debug'), false);
});

test('constructor accepts a custom default level', () => {
  const filter = new LogLevelFilter('warn');
  assert.equal(filter.getThreshold(''), LEVELS.warn);
  assert.equal(filter.allows('', 'warn'), true);
  assert.equal(filter.allows('', 'info'), false);
});

test('child namespaces inherit the nearest ancestor threshold', () => {
  const filter = new LogLevelFilter('error');
  filter.setThreshold('app', 'debug');
  assert.equal(filter.getThreshold('app'), LEVELS.debug);
  assert.equal(filter.getThreshold('app.db'), LEVELS.debug);
  assert.equal(filter.getThreshold('app.db.query'), LEVELS.debug);
  assert.equal(filter.getThreshold('other'), LEVELS.error);
});

test('the most specific threshold wins', () => {
  const filter = new LogLevelFilter();
  filter.setThreshold('app', 'debug');
  filter.setThreshold('app.db', 'error');
  assert.equal(filter.getThreshold('app'), LEVELS.debug);
  assert.equal(filter.getThreshold('app.db'), LEVELS.error);
  assert.equal(filter.getThreshold('app.db.query'), LEVELS.error);
  assert.equal(filter.getThreshold('app.http'), LEVELS.debug);
});

test('a namespace that merely shares a prefix does not inherit', () => {
  const filter = new LogLevelFilter();
  filter.setThreshold('app', 'debug');
  // "application" starts with "app" as a string but is not a child in the
  // dot-separated hierarchy, so it must keep the root threshold.
  assert.equal(filter.getThreshold('application'), LEVELS.info);
});

test('allows uses >= so the threshold level itself is emitted', () => {
  const filter = new LogLevelFilter('warn');
  assert.equal(filter.allows('', 'warn'), true);
  assert.equal(filter.allows('', 'error'), true);
  assert.equal(filter.allows('', 'fatal'), true);
  assert.equal(filter.allows('', 'info'), false);
  assert.equal(filter.allows('', 'debug'), false);
  assert.equal(filter.allows('', 'trace'), false);
});

test('thresholds can be raised and lowered at runtime', () => {
  const filter = new LogLevelFilter('info');
  assert.equal(filter.allows('svc', 'debug'), false);
  filter.setThreshold('svc', 'trace');
  assert.equal(filter.allows('svc', 'debug'), true);
  filter.setThreshold('svc', 'fatal');
  assert.equal(filter.allows('svc', 'error'), false);
  assert.equal(filter.allows('svc', 'fatal'), true);
});

test('pick returns the level when allowed and undefined otherwise', () => {
  const filter = new LogLevelFilter('error');
  assert.equal(filter.pick('', 'error'), 'error');
  assert.equal(filter.pick('', 'warn'), undefined);
  assert.equal(filter.pick('', LEVELS.fatal), LEVELS.fatal);
});

test('setThreshold validates its arguments', () => {
  const filter = new LogLevelFilter();
  assert.throws(() => filter.setThreshold(42, 'info'), TypeError);
  assert.throws(() => filter.setThreshold('ns', 'verbose'), TypeError);
  assert.throws(() => filter.getThreshold(42), TypeError);
});

test('setThreshold is chainable', () => {
  const filter = new LogLevelFilter();
  const result = filter.setThreshold('a', 'debug').setThreshold('b', 'error');
  assert.equal(result, filter);
  assert.equal(filter.getThreshold('a'), LEVELS.debug);
  assert.equal(filter.getThreshold('b'), LEVELS.error);
});

test('numeric thresholds are accepted and compared numerically', () => {
  const filter = new LogLevelFilter(LEVELS.info);
  filter.setThreshold('n', LEVELS.error);
  assert.equal(filter.allows('n', LEVELS.error), true);
  assert.equal(filter.allows('n', LEVELS.warn), false);
});

test('empty namespace is the root and can be overridden', () => {
  const filter = new LogLevelFilter('debug');
  filter.setThreshold('', 'fatal');
  assert.equal(filter.getThreshold(''), LEVELS.fatal);
  assert.equal(filter.getThreshold('child'), LEVELS.fatal);
});
