// Development catalog only: retain grid breakpoints and pack cards vertically.
(() => {
    const container = document.querySelector('.section-container');
    if (!container || !('ResizeObserver' in window)) return;
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
