/* Native FO Runtime v2. Register by template ID; instances are root-scoped. */
(() => {
    class Component extends fo.Section {
        constructor(element, runtime) {
            super(element, runtime);
            runtime.behaviors.common(this);

        }

        destroy() { super.destroy(); }
    }
    fo.register("v2mYV3", Component);
})();

