// @ts-check
'use strict';

/**
 * @param {unknown} value
 * @returns {value is {chromium: Pick<(typeof import("playwright"))["chromium"], "launch">}}
 */
function isPlaywright(value) {
  if (typeof value !== 'object' || value === null || !('chromium' in value)) return false;
  const chromium = value.chromium;
  return typeof chromium === 'object' && chromium !== null
    && 'launch' in chromium && typeof chromium.launch === 'function';
}

/** @param {string} source */
function loadPlaywright(source) {
  /** @type {unknown} */
  const value = require(source);
  if (!isPlaywright(value)) throw new Error(`Модуль ${source} не предоставляет chromium.launch`);
  return value;
}

module.exports = {loadPlaywright};
