/** Database URLs name thumbnails; .og is inserted before the last extension. */
export function originalImageUrl(value) {
    if (!value || /^(data:|blob:)/i.test(value)) return value || '';
    return value.replace(/([^?#]*)([?#].*)?$/, (_, path, tail = '') => {
        path = path.replace(/!(?:f?\d+|full)$/, '');
        return path.replace(/(?:\.og)?\.(webp|png|jpe?g|gif|bmp)$/i, '.og.$1') + tail;
    });
}

/** Keep the placeholder until the full image loads; clean up when a section is removed. */
export function observeImages(section, browser = window) {
    let disposed = false;
    const pending = new Set();
    const load = image => {
        if (image.dataset.foImageState) return;
        const source = image.dataset.original || image.dataset.lazy;
        if (!source) return;
        image.dataset.foImageState = 'loading';
        const preload = new browser.Image();
        pending.add(preload);
        preload.onload = () => {
            pending.delete(preload);
            if (disposed) return;
            image.src = source;
            image.decoding = 'async';
            image.dataset.foImageState = 'loaded';
            image.classList.remove('lazy');
        };
        preload.onerror = () => {
            pending.delete(preload);
            if (!disposed) delete image.dataset.foImageState;
        };
        preload.src = source;
    };
    const observer = browser.IntersectionObserver ? new browser.IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            load(entry.target);
        });
    }, {rootMargin: '300px 0px'}) : null;
    const targets = section.all('img[data-original], img[data-lazy]');
    targets.forEach(image => {
        // The placeholder must load immediately; only the full image is deferred.
        image.removeAttribute('loading');
        if (observer) observer.observe(image); else load(image);
    });
    section.cleanup(() => {
        disposed = true;
        observer?.disconnect();
        pending.forEach(image => { image.onload = null; image.onerror = null; });
        pending.clear();
        targets.forEach(image => {
            if (image.dataset.foImageState === 'loading') delete image.dataset.foImageState;
        });
    });
}
