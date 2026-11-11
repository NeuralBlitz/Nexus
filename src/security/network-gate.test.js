import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeNetworkRequest, requireNetworkAuthorization } from './network-gate.js';

const KEY = 'this-is-a-demo-test-key-at-least-32-chars';

test('denies requests when server authentication is not configured', () => {
  assert.equal(authorizeNetworkRequest({ headers: {} }, undefined).status, 503);
  assert.equal(authorizeNetworkRequest({ headers: {} }, 'short').status, 503);
});

test('denies absent, incorrect and improperly formatted tokens', () => {
  assert.equal(authorizeNetworkRequest({ headers: {} }, KEY).status, 401);
  assert.equal(authorizeNetworkRequest({ headers: { 'x-api-key': 'incorrect' } }, KEY).status, 401);
  assert.equal(authorizeNetworkRequest({ headers: { authorization: 'Basic abc' } }, KEY).status, 401);
  assert.equal(authorizeNetworkRequest({ headers: { authorization: 'Bearer wrong' } }, KEY).status, 401);
});

test('accepts a valid API key through either supported header', () => {
  assert.equal(authorizeNetworkRequest({ headers: { 'x-api-key': KEY } }, KEY).allowed, true);
  assert.equal(authorizeNetworkRequest({ headers: { authorization: 'Bearer ' + KEY } }, KEY).allowed, true);
});

test('does not accept URL query-string tokens', () => {
  assert.equal(authorizeNetworkRequest({ headers: {}, url: '/?token=' + KEY }, KEY).status, 401);
});

test('Express middleware denies unauthorized clients without calling next', () => {
  let nextCalled = false;
  const previous = process.env.NEXUS_API_KEY;
  try {
    process.env.NEXUS_API_KEY = KEY;
    const response = {
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; }
    };
    requireNetworkAuthorization({ headers: {} }, response, () => { nextCalled = true; });
    assert.equal(response.code, 401);
    assert.equal(nextCalled, false);
    requireNetworkAuthorization({ headers: { 'x-api-key': KEY } }, response, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  } finally {
    if (previous === undefined) delete process.env.NEXUS_API_KEY;
    else process.env.NEXUS_API_KEY = previous;
  }
});
