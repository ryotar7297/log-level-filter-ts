// Core log level filtering logic. This module is deliberately small and
// dependency-free so it can be embedded anywhere.

/**
 * Ordered severity levels. The numeric values are used for comparisons, so
 * they must be strictly increasing. Only these names are accepted by
 * `normalizeLevel`; anything else is an error rather than a silent fallback
 * because silently mapping an unknown level to DEBUG would hide bugs.
 */
export const LEVELS = Object.freeze({
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
});

/**
 * Convert a level name or numeric value to its numeric rank.
 *
 * Accepts the canonical lowercase names in LEVELS, or a number that exactly
 * matches one of those ranks. Case is folded for names so callers can pass
 * `"INFO"` without surprises. Throws a TypeError for anything else; this is
 * intentional because a typo like `"warning"` should fail loudly at
 * configuration time, not silently disable logging.
 *
 * @param {string|number} level
 * @returns {number}
 */
export function normalizeLevel(level) {
  if (typeof level === 'number') {
    for (const value of Object.values(LEVELS)) {
      if (value === level) return value;
    }
    throw new TypeError(`unknown numeric log level: ${level}`);
  }
  if (typeof level === 'string') {
    const key = level.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LEVELS, key)) {
      return LEVELS[key];
    }
    throw new TypeError(`unknown log level name: ${level}`);
  }
  throw new TypeError(`log level must be a string or number, got ${typeof level}`);
}

/**
 * A hierarchical filter with per-namespace thresholds.
 *
 * Namespaces are dot-separated strings. A threshold set on a parent applies
 * to every child unless the child (or a more specific descendant) overrides
 * it. The root namespace is the empty string `""`; setting its threshold
 * changes the default for all namespaces.
 *
 * The filter is mutable at runtime via `setThreshold`. This is the point of
 * the library: a process can raise or lower verbosity for a subsystem without
 * a restart, and without every call site knowing the current threshold.
 */
export class LogLevelFilter {
  /**
   * @param {string|number} [defaultLevel='info'] threshold applied to the
   *   root namespace when no other threshold is configured.
   */
  constructor(defaultLevel = 'info') {
    this._thresholds = new Map();
    this._thresholds.set('', normalizeLevel(defaultLevel));
  }

  /**
   * Set the threshold for `namespace` and all of its descendants that do not
   * have a more specific threshold of their own.
   *
   * @param {string} namespace dot-separated namespace, `""` for the root.
   * @param {string|number} level
   * @returns {this}
   */
  setThreshold(namespace, level) {
    if (typeof namespace !== 'string') {
      throw new TypeError(`namespace must be a string, got ${typeof namespace}`);
    }
    this._thresholds.set(namespace, normalizeLevel(level));
    return this;
  }

  /**
   * Resolve the effective threshold for a namespace by walking up its parent
   * chain. The empty-string root is always present, so this never throws for
   * a well-formed namespace.
   *
   * @param {string} namespace
   * @returns {number}
   */
  getThreshold(namespace) {
    if (typeof namespace !== 'string') {
      throw new TypeError(`namespace must be a string, got ${typeof namespace}`);
    }
    let current = namespace;
    while (true) {
      if (this._thresholds.has(current)) {
        return this._thresholds.get(current);
      }
      const dot = current.lastIndexOf('.');
      if (dot === -1) {
        // Fall back to the root. The constructor guarantees it exists, but
        // returning a defensive default keeps the method total even if the
        // map is mutated through a subclass.
        return this._thresholds.get('') ?? LEVELS.info;
      }
      current = current.slice(0, dot);
    }
  }

  /**
   * Decide whether a message at `level` in `namespace` should be propagated.
   *
   * A message is allowed when its rank is greater than or equal to the
   * effective threshold. Equality is allowed so that setting the threshold to
   * `"warn"` still emits warnings themselves.
   *
   * @param {string} namespace
   * @param {string|number} level
   * @returns {boolean}
   */
  allows(namespace, level) {
    const rank = normalizeLevel(level);
    return rank >= this.getThreshold(namespace);
  }

  /**
   * Convenience wrapper that returns `level` when it is allowed, otherwise
   * `undefined`. Useful in expression position: `filter.pick(ns, 'debug')`.
   *
   * @param {string} namespace
   * @param {string|number} level
   * @returns {string|number|undefined}
   */
  pick(namespace, level) {
    return this.allows(namespace, level) ? level : undefined;
  }
}
