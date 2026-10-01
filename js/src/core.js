const global = window;
const document = global.document;

const findElements = (root, selector) => {
    const result = [];
    if (!root) return result;
    if (root.nodeType === 1 && root.matches(selector)) result.push(root);
    if (root.querySelectorAll) result.push(...root.querySelectorAll(selector));
    return result;
};

const emit = (target, name, detail) => {
    target.dispatchEvent(new global.CustomEvent(name, {
        bubbles: true,
        detail
    }));
};

class Runtime {
    constructor() {
        this.components = new Map();
        this.instances = new WeakMap();
        this.version = '2.0.0';
        this.config = {
            siteId: '',
            title: '',
            lang: 'en',
            prefix: '/',
            apiBase: '',
            formsPath: 'forms',
            app: 5000,
            requestTimeout: 15000
        };
        this.http = null;
        this.dialog = null;
        this.inquiry = null;
        this.i18n = null;
    }

    register(name, Component) {
        if (!name || typeof Component !== 'function') {
            throw new TypeError('register(name, Component) requires a component constructor');
        }
        this.components.set(name, Component);
        return this;
    }

    unregister(name) {
        this.components.delete(name);
        return this;
    }

    has(name) {
        return this.components.has(name);
    }

    mount(root = document) {
        findElements(root, '[data-section]').forEach((element) => {
            if (this.instances.has(element)) return;

            const name = element.dataset.section;
            const Component = this.components.get(name);
            if (!Component) return;

            try {
                const instance = new Component(element, this);
                this.instances.set(element, instance);
                element.dataset.foMounted = '';
                emit(element, 'fo:section-mounted', {name, instance});
            } catch (error) {
                console.error(`[fo] Failed to mount section "${name}"`, error);
                emit(element, 'fo:section-error', {name, error});
            }
        });

        this.inquiry?.mount(root);
        return root;
    }

    unmount(root = document) {
        this.inquiry?.unmount(root);
        findElements(root, '[data-fo-mounted]').forEach((element) => {
            const instance = this.instances.get(element);
            instance?.destroy?.();
            this.instances.delete(element);
            delete element.dataset.foMounted;
        });
        return root;
    }

    getInstance(element) {
        return this.instances.get(element) ?? null;
    }

    init(config = {}) {
        this.config = {...this.config, ...config};
        this.i18n?.setLocale(this.config.lang);
        this.mount(document);
        emit(document, 'fo:ready', {runtime: this, config: this.config});
        return this;
    }
}

const fo = new Runtime();
global.fo = fo;

export {document, emit, findElements, fo, global, Runtime};
