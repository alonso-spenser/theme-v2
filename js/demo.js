// Static demonstrations only. Never include this entry in production bundles.
(() => {
    const node = document.getElementById('demo-config');
    fo.init(node ? JSON.parse(node.textContent) : {preview: true, lang: 'en', prefix: '/'});
})();
