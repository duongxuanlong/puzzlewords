/**
 * EventBus — minimal synchronous emitter connecting GameSession to view/ui.
 * Engine-free. Event names live in data/Constants.js (EVENTS); payloads are plain objects.
 */
'use strict';

class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  /** @returns {Function} unsubscribe */
  on(event, fn, ctx) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, []);
    }
    this._handlers.get(event).push({ fn, ctx });
    return () => this.off(event, fn, ctx);
  }

  off(event, fn, ctx) {
    const list = this._handlers.get(event);
    if (list) {
      this._handlers.set(event, list.filter((h) => h.fn !== fn || h.ctx !== ctx));
    }
  }

  emit(event, payload) {
    (this._handlers.get(event) || []).slice().forEach((h) => h.fn.call(h.ctx, payload));
  }
}

module.exports = EventBus;
