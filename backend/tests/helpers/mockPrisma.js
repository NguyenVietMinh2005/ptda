// backend/tests/helpers/mockPrisma.js
import prisma from '../../src/config/prisma.js';

const mocks = [];

/**
 * Mock an existing method on a target object (e.g. prisma.dAT_PHONG.findFirst)
 * Safely preserves the original method and restores it when cleanup is invoked.
 */
export function mockMethod(target, prop, fakeFn) {
  if (!target) {
    throw new Error(`Cannot mock property '${prop}' on undefined/null target`);
  }
  const original = target[prop];
  target[prop] = fakeFn;
  mocks.push(() => {
    target[prop] = original;
  });
}

/**
 * Mock prisma.$transaction to immediately execute the callback with a mock or proxy tx.
 * Defaults to passing `prisma` itself as `tx` so calls to tx.dAT_PHONG use the mocked prisma delegates.
 */
export function mockTransaction(customTx = null) {
  const originalTx = prisma.$transaction;
  prisma.$transaction = async (callbackOrArray) => {
    if (typeof callbackOrArray === 'function') {
      return await callbackOrArray(customTx || prisma);
    }
    if (Array.isArray(callbackOrArray)) {
      return await Promise.all(callbackOrArray);
    }
    return callbackOrArray;
  };
  mocks.push(() => {
    prisma.$transaction = originalTx;
  });
}

/**
 * Restore all active mocks. Call in afterEach().
 */
export function restoreAllMocks() {
  while (mocks.length > 0) {
    const restore = mocks.pop();
    try {
      restore();
    } catch (e) {
      console.error('Error restoring mock:', e);
    }
  }
}

