import {fo, global} from './core.js';

/** Shared native lifecycle; every resource belongs to a single mounted section. */
class Section {
    constructor(element, runtime) {
        this.element = element;
        this.runtime = runtime;
        this.controller = new global.AbortController();
        this.cleanups = [];
    }

    all(selector) { return [...this.element.querySelectorAll(selector)]; }
    one(selector) { return this.element.querySelector(selector); }
    on(target, type, handler, options = {}) {
        target?.addEventListener(type, handler, {...options, signal: this.controller.signal});
    }
    delegate(type, selector, handler) {
        this.on(this.element, type, event => {
            const target = event.target.closest?.(selector);
            if (target && this.element.contains(target)) handler(event, target);
        });
    }
    cleanup(fn) { this.cleanups.push(fn); return fn; }
    interval(fn, delay) {
        const id = global.setInterval(fn, delay);
        this.cleanup(() => global.clearInterval(id));
    }
    dialog(options) {
        const dialog = this.runtime.dialog.open(options);
        this.cleanup(() => dialog.close());
        return dialog;
    }
    destroy() {
        this.controller.abort();
        for (const dispose of this.cleanups.splice(0).reverse()) dispose();
    }
}

fo.Section = Section;
export {Section};
