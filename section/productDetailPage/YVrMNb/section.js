/* Native FO Runtime v2. Register by template ID; instances are root-scoped. */
(() => {
    class Component extends fo.Section {
        constructor(element, runtime) {
            super(element, runtime);
            runtime.behaviors.common(this);
            runtime.behaviors.tabs(this);
            runtime.behaviors.videos(this);
            runtime.behaviors.downloads(this);
        }

        destroy() { super.destroy(); }
    }
    fo.register("YVrMNb", Component);
})();

