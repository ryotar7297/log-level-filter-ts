# log-level-filter-ts

Hierarchical log level filtering that decides whether a message at a given severity should be propagated, with runtime-tunable thresholds per namespace.

```js
import { LogLevelFilter } from './src/index.js';

const filter = new LogLevelFilter('info');
filter.setThreshold('app.db', 'debug');

filter.allows('app', 'debug');       // false, inherits root 'info'
filter.allows('app.db', 'debug');    // true, explicit threshold
filter.allows('app.db.query', 'trace'); // false, 'debug' threshold

filter.setThreshold('app.db', 'error'); // change at runtime
filter.allows('app.db', 'debug');    // false now
```

## Why this exists

Most logging setups bake a level into the logger at construction time, or require every call site to ask a global mutable singleton. When you want to turn up verbosity for one subsystem during an incident, the first approach forces a restart and the second couples unrelated modules to a shared switch.

This library keeps a small map of namespace to threshold and resolves the effective threshold by walking the dot-separated namespace upwards. The trade-off is that lookup is O(depth of namespace) rather than O(1); for log gating that is irrelevant, and it buys the ability to change a parent threshold once and have every descendant pick it up immediately.

## The awkward edge

Namespace matching is purely textual on dots. A threshold set on `app` does **not** apply to `application`, even though one string is a prefix of the other. This is deliberate: prefix matching without a separator produces surprising inheritance. If you want `application` to inherit, either set its threshold explicitly or name it `app.application`.

## API

- `LEVELS` — frozen object mapping `trace`, `debug`, `info`, `warn`, `error`, `fatal` to increasing numeric ranks.
- `normalizeLevel(level)` — accepts a canonical level name (case-insensitive) or an exact numeric rank, returns the numeric rank, throws `TypeError` otherwise.
- `new LogLevelFilter(defaultLevel = 'info')` — constructs a filter whose root threshold is `defaultLevel`.
- `filter.setThreshold(namespace, level)` — sets the threshold for `namespace` and its descendants, chainable, throws `TypeError` on bad input.
- `filter.getThreshold(namespace)` — returns the effective numeric rank for `namespace`.
- `filter.allows(namespace, level)` — returns `true` when `level` is at or above the effective threshold.
- `filter.pick(namespace, level)` — returns `level` when allowed, `undefined` otherwise.

The root namespace is the empty string `""`. A message is allowed when its rank is greater than or equal to the effective threshold, so setting a threshold to `"warn"` still emits warnings themselves.
