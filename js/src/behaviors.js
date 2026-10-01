import {fo, global} from './core.js';

const show = (element, visible) => {
    if (!element) return;
    element.hidden = !visible;
    element.style.display = visible ? '' : 'none';
};
const select = (elements, index, name = 'active') => elements.forEach((item, i) => item.classList.toggle(name, i === index));

function images(section) {
    section.all('img[data-original], img[data-lazy]').forEach(image => {
        image.loading = 'lazy';
        image.decoding = 'async';
        image.src = image.dataset.original || image.dataset.lazy;
    });
}

function carousel(section) {
    section.all('[data-carousel]').forEach(element => {
        const slides = [...element.children];
        if (!slides.length) return;
        const originals = slides.map(slide => slide.getAttribute('style'));
        const style = element.getAttribute('style');
        element.style.cssText += ';display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;';
        let index = 0, paused = false;
        const fade = element.dataset.effect === 'fade';
        const columns = () => Math.max(1, Number(global.innerWidth < 600 ? element.dataset.mobileColumn || 1 : element.dataset.column || 1));
        const dots = global.document.createElement('div');
        dots.className = 'fo-carousel-dots';
        const go = value => {
            const max = Math.max(0, slides.length - columns());
            index = value < 0 ? max : value > max ? 0 : value;
            element.scrollTo({left: slides[index].offsetLeft - slides[0].offsetLeft, behavior: 'smooth'});
            if (fade) slides.forEach((slide, i) => {
                slide.style.opacity = i === index ? '1' : '0';
                slide.style.pointerEvents = i === index ? '' : 'none';
            });
            [...dots.children].forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
            const peer = section.all('[data-carousel]').find(other => other !== element && other.dataset.carousel === element.dataset.carouselFor);
            if (peer) peer.scrollTo({left: peer.children[index]?.offsetLeft - peer.children[0]?.offsetLeft || 0, behavior: 'smooth'});
        };
        const resize = () => {
            slides.forEach((slide, i) => {
                slide.style.cssText += `;display:block;float:none;flex:0 0 ${100 / columns()}%;min-width:0;scroll-snap-align:start;`;
                if (fade) slide.style.cssText += `;position:${i === 0 ? 'relative' : 'absolute'};inset:0;width:100%;transition:opacity .3s;opacity:${i===index ? 1 : 0};pointer-events:${i===index ? 'auto' : 'none'};`;
            });
            if (fade) element.style.overflow = 'hidden';
        };
        resize();
        section.on(global, 'resize', resize);
        if (element.dataset.dots === '1') {
            slides.forEach((_, i) => {
                const button = global.document.createElement('button');
                button.type = 'button';
                button.textContent = String(i + 1);
                button.setAttribute('aria-label', `Slide ${i + 1}`);
                section.on(button, 'click', () => go(i));
                dots.append(button);
            });
            element.after(dots);
        }
        const controls = section.all('[data-carousel-next], [data-carousel-prev]').filter(button =>
            (button.dataset.carouselNext || button.dataset.carouselPrev) === element.dataset.carousel);
        controls.forEach(button => {
            button.setAttribute('role', 'button');
            button.tabIndex = 0;
            const action = () => go(index + (button.hasAttribute('data-carousel-next') ? 1 : -1));
            section.on(button, 'click', action);
            section.on(button, 'keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); action(); } });
        });
        section.on(element, 'mouseenter', () => { paused = true; });
        section.on(element, 'mouseleave', () => { paused = false; });
        section.on(element, 'focusin', () => { paused = true; });
        section.on(element, 'focusout', () => { paused = false; });
        if (element.dataset.carouselFor) slides.forEach((slide, i) => section.on(slide, 'click', () => go(i)));
        section.on(element, 'scroll', () => {
            const width = slides[0].getBoundingClientRect().width;
            if (width) index = Math.round(element.scrollLeft / width);
        }, {passive: true});
        const delay = Number(element.dataset.delay);
        if (delay > 0 && !global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            section.interval(() => { if (!paused && !global.document.hidden) go(index + 1); }, Math.max(delay, 500));
        }
        section.cleanup(() => {
            dots.remove();
            if (style === null) element.removeAttribute('style'); else element.setAttribute('style', style);
            slides.forEach((slide, i) => originals[i] === null ? slide.removeAttribute('style') : slide.setAttribute('style', originals[i]));
        });
    });
}

function common(section) {
    images(section);
    carousel(section);
    section.delegate('click', '[data-share]', async (event, target) => {
        event.preventDefault();
        const url = global.location.href;
        const encoded = encodeURIComponent(url);
        const destinations = {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
            twitter: `https://twitter.com/intent/tweet?url=${encoded}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
            email: `mailto:?subject=${encodeURIComponent(global.document.title)}&body=${encoded}`
        };
        const destination = destinations[target.dataset.share];
        if (destination) { global.open(destination, '_blank', 'noopener,noreferrer'); return; }
        if (global.navigator.share) {
            try { await global.navigator.share({url, title: global.document.title}); } catch { /* User dismissed the native sheet. */ }
        } else {
            const content = global.document.createElement('input');
            content.value = url; content.readOnly = true; content.setAttribute('aria-label', 'Share URL');
            content.style.width = '100%';
            section.dialog({title: '复制链接 / Copy link', content});
            content.select();
        }
    });
    section.all('iframe[data-src]').forEach(frame => {
        frame.src = frame.dataset.src; frame.parentElement.classList.remove('section-loading-light');
        section.cleanup(() => frame.removeAttribute('src'));
    });
    section.all('[data-count-digit]').forEach(element => {
        const target = Number(element.dataset.countDigit) || 0;
        const observer = new global.IntersectionObserver(entries => {
            if (!entries.some(entry => entry.isIntersecting)) return;
            observer.disconnect();
            let start;
            let frame;
            const tick = time => {
                start ??= time;
                const progress = Math.min(1, (time - start) / 1000);
                element.textContent = String(Math.round(target * progress));
                if (progress < 1 && !section.controller.signal.aborted) frame = global.requestAnimationFrame(tick);
            };
            frame = global.requestAnimationFrame(tick);
            section.cleanup(() => global.cancelAnimationFrame(frame));
        });
        observer.observe(element);
        section.cleanup(() => observer.disconnect());
    });
    section.delegate('keydown', 'input[data-page-url]', (event, control) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const page = Math.max(1, Math.min(Number(control.dataset.pageCount) || 1, Number(control.value) || 1));
        global.location.assign(control.dataset.pageUrl.replace('{0}', String(page)));
    });
}

function linkage(section, className = 'active') {
    section.delegate('click', '[data-linkage-navigation]', (event, target) => {
        event.preventDefault();
        const group = target.dataset.linkageNavigation;
        const allNav = section.all('[data-linkage-navigation]');
        const keyed = new Set(allNav.map(item => item.dataset.linkageNavigation)).size === allNav.length;
        const nav = keyed ? allNav : allNav.filter(item => item.dataset.linkageNavigation === group);
        if (keyed) {
            select(nav, nav.indexOf(target));
            section.all('[data-linkage-content]').forEach(item => item.classList.toggle(className, item.dataset.linkageContent === group));
            return;
        }
        let content = section.all('[data-linkage-content]').filter(item => item.dataset.linkageContent === group);
        if (!content.length) content = section.all('[data-linkage-content]');
        const index = nav.indexOf(target);
        select(nav, index);
        select(content, index, className);
    });
}

function more(section) {
    const salt = section.element.dataset.section;
    const trigger = section.one(`.${salt}-more, .section-collection-more`);
    const content = section.one(`.${salt}-description, .${salt}-content, .section-collection-describe, .collapse`);
    if (!trigger || !content) return;
    if (content.classList.contains('section-collection-describe') && content.offsetHeight > 180) {
        content.classList.add('close'); trigger.classList.add('show');
    }
    section.on(trigger, 'click', event => {
        event.preventDefault();
        const active = trigger.classList.toggle('active');
        content.classList.toggle('show', active);
        content.classList.toggle('active', active);
        content.classList.toggle('close', !active);
        [...trigger.querySelectorAll('label')].forEach((label, i) => show(label, i === Number(active)));
    });
}

function sidebar(section) {
    section.delegate('click', '.sidebar-open-placeholder, .navbar-open-placeholder', (event, target) => {
        event.preventDefault();
        const active = target.classList.toggle('active');
        show(target.nextElementSibling, active);
    });
}

function tabs(section) {
    section.delegate('click', '[data-tabs="nav"]', (event, target) => {
        event.preventDefault();
        const index = section.all('[data-tabs="nav"]').indexOf(target);
        select(section.all('[data-tabs="nav"]'), index);
        section.all('[data-tabs="pane"]').forEach((pane, i) => show(pane, i === index));
        show(section.one(`.${section.element.dataset.section}-design-section`), index === 0);
    });
    section.delegate('click', '[data-tabs] .nav-link, [data-tabs] > li, [data-tabs] > a', (event, target) => {
        event.preventDefault();
        const nav = target.closest('[data-tabs]');
        const buttons = [...nav.querySelectorAll('.nav-link')];
        const items = buttons.length ? buttons : [...nav.children];
        const index = items.indexOf(target);
        if (index < 0) return;
        select(items, index);
        section.all('[data-pane]').forEach((pane, i) => show(pane, i === index));
    });
}

function videos(section) {
    const salt = section.element.dataset.section;
    const stop = () => {
        section.all('video').forEach(video => { video.pause(); video.classList.remove('active'); });
        section.all('iframe[data-video]').forEach(frame => { frame.removeAttribute('src'); frame.classList.remove('active'); });
    };
    section.cleanup(stop);
    section.delegate('click', '[data-play], [data-player]', (event, trigger) => {
        event.preventDefault();
        const source = trigger.dataset.play;
        if (salt === 'f7Q7fe' && source) {
            const dialog = section.runtime.dialog.video({src: source});
            section.cleanup(() => dialog.close());
            return;
        }
        stop();
        section.all('[data-play]').forEach(item => show(item, true));
        const media = section.all('video[data-video]').find(item => item.dataset.video === source)
            || trigger.parentElement.querySelector('video, iframe') || trigger.querySelector('video, iframe');
        if (!media) return;
        if (media.tagName === 'IFRAME') media.src = media.dataset.video || media.dataset.src;
        else {
            if (media.dataset.video) media.src = media.dataset.video;
            media.play().catch(() => show(trigger, true));
        }
        media.classList.add('active');
        show(media, true);
        if (trigger !== media.parentElement) show(trigger, false);
        else trigger.querySelectorAll('img, .overlay').forEach(item => show(item, false));
    });
    if (salt === 'ZvYvIb') section.all('iframe[data-video]').forEach(frame => { frame.src = frame.dataset.video; frame.classList.add('active'); });
    if (salt === 'nYjQze') {
        const observer = new global.IntersectionObserver(entries => {
            const active = entries.some(entry => entry.isIntersecting);
            section.all('iframe[data-video]').forEach(frame => {
                if (active) frame.src = frame.dataset.video;
                else frame.removeAttribute('src');
                frame.classList.toggle('active', active);
                show(frame, active);
            });
            section.all('[data-play]').forEach(trigger => show(trigger, !active));
        }, {rootMargin: '-40% 0px -40% 0px'});
        observer.observe(section.element);
        section.cleanup(() => observer.disconnect());
    }
}

function header(section) {
    const salt = section.element.dataset.section;
    const root = section.element;
    const searchPanel = section.one(`.${salt}-search`);
    const collapse = section.one('.navbar-collapse');
    if (searchPanel && collapse && global.matchMedia('(max-width: 767px)').matches) {
        const marker = global.document.createComment('search-position');
        searchPanel.before(marker); collapse.append(searchPanel);
        section.cleanup(() => { marker.replaceWith(searchPanel); });
    }
    if (salt === 'qYnEVv') {
        const size = () => {
            const height = global.innerHeight - (section.one('.navbar-menu')?.offsetHeight || 0)
                - (section.one('.qYnEVv-bar')?.offsetHeight || 0) - (section.one('.qYnEVv-notice')?.offsetHeight || 0) - 48;
            section.all('.navbar-fluid .container, .navbar-fluid .container-fluid').forEach(menu => { menu.style.maxHeight = `${Math.max(0, height)}px`; });
        };
        section.on(global, 'resize', size); size();
    }
    const originalFixed = root.classList.contains('fixed-top');
    const transparent = root.classList.contains('transparent');
    const update = () => {
        const top = ['M7FVZr', 'u6zEja'].includes(salt)
            ? (section.one(`.${salt}-bar`)?.offsetHeight || 0) + (section.one(`.${salt}-secondary`)?.offsetHeight || 0) : 0;
        root.classList.toggle('fixed-top', global.scrollY > top);
        if (transparent) root.classList.toggle('transparent', global.scrollY <= top);
    };
    section.on(global, 'scroll', update, {passive: true});
    section.cleanup(() => { root.classList.toggle('fixed-top', originalFixed); if (transparent) root.classList.add('transparent'); });
    update();
    const search = () => {
        const keyword = section.one('[data-search="keyword"]')?.value.trim();
        if (keyword) global.location.assign(`${section.runtime.config.prefix}search?q=${encodeURIComponent(keyword)}`);
    };
    section.delegate('click', '[data-search="button"]', event => { event.preventDefault(); search(); });
    section.delegate('keydown', '[data-search="keyword"]', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
    section.delegate('click', '[data-search="close"], [data-search="open"]', () => {
        const panel = section.one(`.${salt}-search`);
        show(panel, panel && global.getComputedStyle(panel).display === 'none');
    });
    section.delegate('click', '[data-search-clear]', (event, target) => { event.preventDefault(); global.location.assign(target.dataset.url || global.location.pathname); });
    section.delegate('click', '.navbar-toggler, .menu-close', (event, target) => {
        event.preventDefault();
        const expanded = target.classList.toggle('active');
        target.setAttribute('aria-expanded', String(expanded));
        section.one('.navbar-collapse')?.classList.toggle('show');
        section.one(`.${salt}-menu`)?.classList.toggle('active');
        if (['M7FVZr','u6zEja'].includes(salt)) section.all(`.${salt}-bar, .${salt}-secondary`).forEach(item => show(item, !expanded));
    });
    section.delegate('click', `.${salt}-notice-close, .${salt}-bar-close`, (_, target) => show(target.closest(`.${salt}-notice, .${salt}-bar`), false));
    section.delegate('click', '.region-icon', () => section.one(`.${salt}-region`)?.classList.add('show'));
    section.delegate('click', `.${salt}-region .ic-close`, () => section.one(`.${salt}-region`)?.classList.remove('show'));
    section.delegate('click', '.vertical-link', (event, link) => {
        if (global.matchMedia('(max-width: 767px)').matches && link.parentElement.querySelector('.expand-collection')) {
            event.preventDefault(); link.parentElement.classList.toggle('active');
        }
    });
    section.all('.section-drop, .dropdown').forEach(dropdown => {
        section.on(dropdown, 'mouseenter', () => show(dropdown.querySelector('.dropdown-menu'), true));
        section.on(dropdown, 'mouseleave', () => show(dropdown.querySelector('.dropdown-menu'), false));
        section.on(dropdown, 'focusin', () => show(dropdown.querySelector('.dropdown-menu'), true));
    });
    section.all('nav .dropdown-toggle').forEach(toggle => {
        if (toggle.nextElementSibling?.classList.contains('navbar-open-placeholder')) return;
        const button = global.document.createElement('button');
        button.type = 'button';
        button.className = 'navbar-open-placeholder';
        button.setAttribute('aria-label', 'Toggle submenu');
        toggle.after(button);
        section.cleanup(() => button.remove());
    });
    sidebar(section);
}

function gallery(section) {
    section.delegate('click', 'a.spotlight', (event, link) => {
        event.preventDefault();
        const image = global.document.createElement('img');
        image.src = link.href;
        image.alt = link.querySelector('img')?.alt || '';
        image.style.cssText = 'max-width:100%;max-height:80vh;object-fit:contain';
        section.dialog({content: image});
    });
    const salt = section.element.dataset.section;
    section.delegate('click', '.embed-responsive', (_, target) => target.nextElementSibling?.classList.add('show'));
    section.delegate('click', `.${salt}-dialog-close, .dialog-close`, (_, target) => target.closest(`.${salt}-dialog`)?.classList.remove('show'));
    section.all('img[data-swap]').forEach(image => {
        const original = image.src;
        section.on(image.closest('.col-12') || image, 'mouseenter', () => { image.src = image.dataset.swap; });
        section.on(image.closest('.col-12') || image, 'mouseleave', () => { image.src = image.dataset.original || original; });
    });
    section.delegate('click', `.${salt}-grid li`, (_, target) => {
        const items = [...target.parentElement.children];
        const index = items.indexOf(target);
        select(items, index);
        section.all(`.${salt}-grid-content`).forEach((item, i) => { item.classList.toggle('active', i === index); show(item, i === index); });
    });
}

function faq(section) {
    const salt = section.element.dataset.section;
    section.delegate('click', '[data-faq] .text-content-heading, .FBj26f-faq', (_, target) => {
        const item = target.closest(`.${salt}-item, .FBj26f-faq`) || target.parentElement;
        const group = item.parentElement;
        [...group.children].forEach(sibling => sibling.classList.toggle('active', sibling === item));
    });
}

function anchors(section) {
    const salt = section.element.dataset.section;
    const navigation = section.one(`.${salt}-labels, .${salt}-nav`);
    if (navigation) {
        const original = navigation.getAttribute('style');
        navigation.style.position = 'sticky'; navigation.style.top = '0'; navigation.style.zIndex = '2';
        section.cleanup(() => original === null ? navigation.removeAttribute('style') : navigation.setAttribute('style', original));
    }
    section.delegate('click', '[data-anchor], a[href^="#"]', (event, target) => {
        const id = target.dataset.anchor || target.hash.slice(1);
        const destination = section.all('[data-group], [id]').find(item => item.dataset.group === id || item.id === id);
        if (!destination) return;
        event.preventDefault();
        global.scrollTo({top: destination.getBoundingClientRect().top + global.scrollY - 120, behavior: 'smooth'});
    });
}

function splash(section) {
    const key = section.element.dataset.section;
    if (!section.runtime.config.preview && global.localStorage.getItem(key)) section.element.classList.add('collapse');
    section.delegate('click', '[data-action], [data-close]', (_, target) => {
        section.element.classList.add('collapse');
        if (target.dataset.close === 'forever' && !section.runtime.config.preview) global.localStorage.setItem(key, '1');
    });
}

function articleCover(section) {
    section.all('[data-article-item]').forEach(item => section.on(item, 'mouseenter', () => {
        section.all('[data-article-cover]').forEach(cover => show(cover, cover.dataset.articleCover === item.dataset.articleItem));
    }));
}

function focusOnScroll(section) {
    const items = section.all('.text-list, [data-video-item]');
    const update = () => {
        let index = -1, distance = Infinity;
        items.forEach((item, i) => { const box = item.getBoundingClientRect(); const d = Math.abs(box.top + box.height / 2 - global.innerHeight / 2); if (d < distance) { distance = d; index = i; } });
        select(items, index);
    };
    section.on(global, 'scroll', update, {passive: true});
    update();
}

fo.behaviors = {common, linkage, more, sidebar, tabs, videos, header, gallery, faq, anchors, splash, articleCover, focusOnScroll,
    backToTop(section) { section.delegate('click', '.back-to-top, [data-back-top]', () => global.scrollTo({top: 0, behavior: 'smooth'})); }};
export {show, select};
