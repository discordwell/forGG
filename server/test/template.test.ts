import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySaveMappings,
  getVar,
  interpolateAny,
  interpolateString,
  isPlainObject,
  jsonPointerGet,
} from '../src/template';

test('isPlainObject', () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject({ a: 1 }), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject('x'), false);
  assert.equal(isPlainObject(42), false);
});

test('getVar resolves dotted paths', () => {
  const vars = { a: { b: { c: 7 } }, top: 'x' };
  assert.equal(getVar(vars, 'top'), 'x');
  assert.equal(getVar(vars, 'a.b.c'), 7);
  assert.equal(getVar(vars, 'a.missing'), undefined);
  assert.equal(getVar(vars, 'top.deeper'), undefined);
});

test('interpolateString substitutes vars', () => {
  const vars = { name: 'Ada', n: 3, ok: true, obj: { k: 'v' } };
  assert.equal(interpolateString('hi {{name}}', vars), 'hi Ada');
  assert.equal(interpolateString('{{ name }} x{{n}} {{ok}}', vars), 'Ada x3 true');
  assert.equal(interpolateString('missing: [{{nope}}]', vars), 'missing: []');
  assert.equal(interpolateString('json: {{obj}}', vars), 'json: {"k":"v"}');
});

test('interpolateString is safe with replacement-pattern characters', () => {
  // "$&" and friends must come through literally (function replacer).
  assert.equal(interpolateString('v={{v}}', { v: '$&-$1-$$' }), 'v=$&-$1-$$');
});

test('interpolateString resolves nested keys', () => {
  const vars = { contact: { id: 'c_1', name: 'Lee' } };
  assert.equal(interpolateString('/contacts/{{contact.id}}', vars), '/contacts/c_1');
});

test('interpolateAny walks arrays and objects', () => {
  const vars = { id: 'x9', n: 2 };
  const input = {
    path: '/c/{{id}}',
    list: ['{{id}}', 5, { deep: '{{n}}' }],
    untouched: 42,
    nul: null,
  };
  assert.deepEqual(interpolateAny(input, vars), {
    path: '/c/x9',
    list: ['x9', 5, { deep: '2' }],
    untouched: 42,
    nul: null,
  });
});

test('jsonPointerGet basic traversal', () => {
  const doc = { a: { b: [10, { c: 'hit' }] }, 'x/y': 1, 'ti~lde': 2 };
  assert.equal(jsonPointerGet(doc, '/a/b/0'), 10);
  assert.equal(jsonPointerGet(doc, '/a/b/1/c'), 'hit');
  assert.equal(jsonPointerGet(doc, '/'), doc);
  assert.equal(jsonPointerGet(doc, ''), undefined);
  assert.equal(jsonPointerGet(doc, 'a/b'), undefined); // must start with '/'
});

test('jsonPointerGet escapes ~1 and ~0', () => {
  const doc = { 'x/y': 1, 'ti~lde': 2 };
  assert.equal(jsonPointerGet(doc, '/x~1y'), 1);
  assert.equal(jsonPointerGet(doc, '/ti~0lde'), 2);
});

test('jsonPointerGet misses return undefined', () => {
  const doc = { a: [1], s: 'str' };
  assert.equal(jsonPointerGet(doc, '/a/5'), undefined);
  assert.equal(jsonPointerGet(doc, '/a/-1'), undefined);
  assert.equal(jsonPointerGet(doc, '/a/x'), undefined);
  assert.equal(jsonPointerGet(doc, '/s/0'), undefined); // no traversal into strings
  assert.equal(jsonPointerGet(doc, '/nope/deep'), undefined);
});

test('applySaveMappings saves matched pointers into vars', () => {
  const vars: Record<string, unknown> = {};
  const data = { contact: { id: 'c_42' }, list: [{ id: 'first' }] };
  const saved = applySaveMappings(
    {
      contactId: '/contact/id',
      firstId: ['/missing', '/list/0/id'],
      absent: '/not/there',
    },
    data,
    vars
  );
  assert.deepEqual(saved, { contactId: 'c_42', firstId: 'first' });
  assert.equal(vars.contactId, 'c_42');
  assert.equal(vars.firstId, 'first');
  assert.equal('absent' in vars, false);
});

test('applySaveMappings with no save returns empty object', () => {
  const vars: Record<string, unknown> = { keep: 1 };
  assert.deepEqual(applySaveMappings(undefined, { a: 1 }, vars), {});
  assert.deepEqual(vars, { keep: 1 });
});
