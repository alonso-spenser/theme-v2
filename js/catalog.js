// Development catalog only: retain grid breakpoints and pack cards vertically.
(() => {
    const container = document.querySelector('.section-container');
    if (!container) return;
    let noticeTimer;
    container.addEventListener('click', async event => {
        const button = event.target.closest('[data-copy-command]');
        if (!button) return;
        const command = button.dataset.copyCommand;
        let copied = false;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(command);
                copied = true;
            }
        } catch { /* Local HTTP or clipboard permissions may require the fallback. */ }
        if (!copied) {
            const input = document.createElement('textarea');
            input.value = command;
            input.setAttribute('readonly', '');
            input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px';
            document.body.append(input);
            input.focus({preventScroll: true});
            input.select();
            input.setSelectionRange(0, input.value.length);
            try { copied = document.execCommand('copy'); } catch { /* Show manual copy below. */ }
            input.remove();
            button.focus({preventScroll: true});
        }
        if (!copied) window.prompt('请手动复制编译命令', command);
        const status = document.getElementById('copy-status');
        if (copied && status) {
            button.textContent = 'COPIED';
            setTimeout(() => { button.textContent = 'COPY'; }, 2000);
            clearTimeout(noticeTimer);
            status.textContent = `已复制：${command}`;
            status.hidden = false;
            noticeTimer = setTimeout(() => { status.hidden = true; }, 2500);
        }
    });
    if (!('ResizeObserver' in window)) return;
    const cards = [...container.children];
    let frame;
    function layout() {
        const heights = cards.map(card => Math.ceil(card.getBoundingClientRect().height));
        cards.forEach((card, index) => {
            const span = `span ${heights[index] + 20}`;
            if (card.style.gridRowEnd !== span) card.style.gridRowEnd = span;
        });
        container.classList.add('is-masonry');
    }
    function schedule() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(layout);
    }
    layout();
    const observer = new ResizeObserver(schedule);
    cards.forEach(card => observer.observe(card));
    document.fonts?.ready.then(schedule);
})();
