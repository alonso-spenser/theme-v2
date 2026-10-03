import {originalImageUrl} from './images.js';
import {fo, global} from './core.js';
import {show} from './behaviors.js';

const node = (tag, text, className) => {
    const element = global.document.createElement(tag);
    if (text !== undefined) element.textContent = String(text);
    if (className) element.className = className;
    return element;
};
const safeUrl = value => {
    try {
        const url = new URL(value, global.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch { return '#'; }
};
const notice = (section, message) => section.dialog({content: node('p', message)});
async function request(section, path, data) {
    if (section.runtime.config.preview) throw new Error('预览模式不提交业务请求 / Preview does not submit business requests');
    const result = await section.runtime.http.post(path, data, {signal: section.controller.signal});
    if (!result?.success) throw new Error(result?.message || result?.code || 'Request failed');
    return result.data;
}
const guarded = (section, action) => async (...args) => {
    try { await action(...args); }
    catch (error) { if (!section.controller.signal.aborted) notice(section, error.message); }
};

function productCard(section, product, article = false) {
    const column = node('article', undefined, 'col-md-3 col-6 fo-product-card');
    const card = node('a', undefined, 'card');
    card.href = safeUrl(`${section.runtime.config.prefix}${article ? 'article' : 'item'}/${encodeURIComponent(product.seoUrl || product.id || '')}`);
    if (product.coverImage) {
        const image = node('img', undefined, 'card-img-top');
        image.src = safeUrl(originalImageUrl(product.coverImage));
        image.alt = product.title || '';
        image.loading = 'lazy';
        card.append(image);
    }
    const body = node('div', undefined, 'card-body');
    body.append(node('h3', product.title || '', 'text-content-heading'));
    if (product.subtitle) body.append(node('p', product.subtitle, 'text-body'));
    card.append(body);
    column.append(card);
    return column;
}

function productFilter(section) {
    const salt = section.element.dataset.section;
    const goods = section.one('[data-filter-goods]');
    const conditions = section.one('[data-filter-params], .N3mQnq-condition');
    if (!goods || !conditions) return;
    section.all('.filter-button, .IN3ymu-filter').forEach(button => {
        button.setAttribute('role', 'button'); button.tabIndex = 0;
        button.setAttribute('aria-label', 'Filter');
        if (!button.textContent.trim()) button.textContent = 'Filter';
    });
    let items = [], selected = {}, sortField = '', descending = false, generation = 0;
    const specs = item => Object.fromEntries((item.specList || []).filter(spec => spec.key?.trim()).map(spec => [spec.key.trim(), String(spec.value || '')]));
    const render = () => {
        const visible = items.filter(item => Object.entries(selected).every(([field, value]) => !value || String(specs(item)[field] || '').split(',').map(s => s.trim()).includes(value)));
        if (sortField) visible.sort((a, b) => {
            const left = specs(a)[sortField] || '', right = specs(b)[sortField] || '';
            const digit = (a.specList || []).some(spec => spec.key === sortField && spec.digit === 0);
            return (digit ? Number(left) - Number(right) : left.localeCompare(right)) * (descending ? -1 : 1);
        });
        goods.replaceChildren();
        if (!visible.length) { goods.append(node('p', '暂无数据 / No data')); return; }
        if (goods.dataset.layout === 'table') {
            const table = node('table', undefined, 'table');
            const fields = [...new Set(items.flatMap(item => Object.keys(specs(item))))];
            const header = node('tr');
            header.append(node('th', 'Product'));
            for (const field of fields) {
                const cell = node('th');
                const button = node('button', field);
                button.type = 'button'; button.dataset.sort = field;
                cell.append(button); header.append(cell);
            }
            const head = node('thead'); head.append(header); table.append(head);
            const body = node('tbody');
            visible.forEach(item => {
                const row = node('tr');
                const title = node('td');
                const link = node('a', item.title); link.href = safeUrl(`${section.runtime.config.prefix}item/${encodeURIComponent(item.seoUrl || item.id)}`); title.append(link);
                row.append(title);
                fields.forEach(field => row.append(node('td', specs(item)[field] || '')));
                body.append(row);
            });
            table.append(body); goods.append(table);
        } else {
            const row = node('div', undefined, 'row row-gutter');
            visible.forEach(item => {
                const card = productCard(section, item);
                if (Object.keys(specs(item)).length) {
                    const detail = node('details'); detail.append(node('summary', '规格 / Specifications'));
                    for (const [key, value] of Object.entries(specs(item))) detail.append(node('p', `${key}: ${value}`));
                    card.append(detail);
                }
                row.append(card);
            });
            goods.append(row);
        }
    };
    const load = guarded(section, async collectionId => {
        const token = ++generation;
        const result = section.runtime.config.preview ? (section.runtime.config.previewData?.productList || []) : await request(section, '/api/goods/filter', {collectionId, siteId: section.runtime.config.siteId, region: section.runtime.config.lang});
        if (section.controller.signal.aborted || token !== generation) return;
        items = Array.isArray(result) ? result : [];
        section.one(`.${salt}-filter`)?.classList.toggle('active', items.length > 0);
        selected = {};
        conditions.replaceChildren();
        const fields = new Map();
        items.forEach(item => (item.specList || []).forEach(spec => {
            if (!spec.key?.trim() || (salt === 'N3mQnq' && (spec.param !== 0 || spec.leaf !== 0))) return;
            const values = fields.get(spec.key) || new Set();
            String(spec.value || '').split(',').forEach(value => { if (value.trim()) values.add(value.trim()); });
            fields.set(spec.key, values);
        }));
        for (const [key, values] of fields) {
            const select = node('select', undefined, 'form-control form-control-sm');
            select.dataset.field = key; select.setAttribute('aria-label', key);
            const any = node('option', key); any.value = ''; select.append(any);
            [...values].sort().forEach(value => { const option = node('option', value); option.value = value; select.append(option); });
            conditions.append(select);
        }
        section.all('.section-loading-light').forEach(item => item.classList.remove('section-loading-light'));
        render();
    });
    section.delegate('change', '[data-field]', (_, control) => { selected[control.dataset.field] = control.value; render(); });
    section.delegate('click', '[data-sort]', (_, button) => { descending = sortField === button.dataset.sort ? !descending : false; sortField = button.dataset.sort; render(); });
    section.delegate('change', 'select[data-collection]', (_, control) => load(control.value));
    section.delegate('click', '[data-filter]', (_, control) => { section.all('[data-filter]').forEach(item => item.classList.toggle('active', item === control)); load(control.dataset.filter); });
    section.delegate('click', '.filter-button, .IN3ymu-filter', () => conditions.classList.toggle('active'));
    section.delegate('keydown', '.filter-button, .IN3ymu-filter', event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); conditions.classList.toggle('active'); } });
    load(section.one('select[data-collection]')?.value || section.one('[data-filter]')?.dataset.filter || '');
}

function search(section) {
    const container = section.one('[data-article-scale]');
    if (!container) return;
    const key = new URL(global.location.href).searchParams.get('q')?.trim() || '';
    section.all('h1').forEach(heading => { heading.textContent = key ? `${heading.dataset.tips || ''}${key}` : heading.dataset.title || heading.textContent; });
    guarded(section, async () => {
        const items = section.runtime.config.preview ? section.runtime.config.previewData?.searchList || [] : await section.runtime.http.get(`/article-${encodeURIComponent(section.runtime.config.lang)}.json`, null, {signal: section.controller.signal});
        if (section.controller.signal.aborted) return;
        const words = key.toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const matches = items.filter(item => !words.length || words.some(word => String(item.title).toLocaleLowerCase().includes(word)));
        container.replaceChildren();
        for (const [type, label, visible] of [[2, 'Products', container.dataset.productVisible], [1, 'Articles', container.dataset.articleVisible]]) {
            if (visible === 'false') continue;
            let list = matches.filter(item => Number(item.infoType) === type);
            if (!words.length) list = list.slice(0, 24 / (Number(container.dataset.column) || 3));
            if (!list.length) continue;
            container.append(node('h3', label));
            const row = node('div', undefined, 'row row-gutter');
            list.forEach(item => row.append(productCard(section, item, type === 1)));
            container.append(row);
        }
        if (!container.children.length) container.append(node('p', '未找到结果 / No results'));
    })();
}

function pagination(section) {
    const select = section.one('select[name="filterBy"]');
    const goods = section.one('.goods-list');
    if (!select || !goods) return;
    select.value = new URL(global.location.href).searchParams.get('sort') || select.value;
    const load = guarded(section, async current => {
        const data = section.runtime.config.preview ? {records: section.runtime.config.previewData?.productList || [], current: 1, size: 12, total: 0} : await request(section, '/api/shop/featured-goods', {
            current, size: 12, orderBy: select.value,
            params: {collectionId: section.one('[data-collection]')?.dataset.collection, siteId: section.runtime.config.siteId, infoType: 2, searchType: 1, keyword: '', region: section.runtime.config.lang}
        });
        if (section.controller.signal.aborted) return;
        const row = node('div', undefined, 'row row-gutter');
        (data.records || data.list || []).forEach(item => row.append(productCard(section, item)));
        goods.replaceChildren(row);
        const paging = section.one('.pagination');
        if (paging) {
            paging.replaceChildren();
            for (let page = 1; page <= Math.ceil(data.total / data.size); page++) {
                const button = node('button', page, 'page-link'); button.type = 'button'; button.dataset.page = page;
                button.disabled = page === data.current; paging.append(button);
            }
        }
    });
    section.on(select, 'change', () => load(1));
    section.delegate('click', '[data-page]', (_, target) => load(Number(target.dataset.page)));
    if (new URL(global.location.href).searchParams.has('sort')) load(1);
}

function downloads(section) {
    const save = (url, name) => { const link = node('a'); link.href = safeUrl(url); link.download = name; link.rel = 'noopener'; link.target = '_blank'; link.click(); };
    section.delegate('click', '[data-down-file]', (event, target) => {
        event.preventDefault();
        if (target.dataset.downFile) save(target.dataset.downFile, target.textContent.trim());
        else section.all('[data-down-group]').forEach(group => group.classList.toggle('active', group.dataset.downGroup === target.dataset.resourceId));
    });
    section.delegate('click', '[data-down-get]', guarded(section, async (event, target) => {
        event.preventDefault();
        const id = target.dataset.downGet;
        const password = section.all('[data-down-pass]').find(item => item.dataset.downPass === id);
        if (!password?.value.trim()) throw new Error('请输入密码 / Enter password');
        const result = await request(section, '/api/file/down', {siteId: section.runtime.config.siteId, resourceId: id, collectionId: target.dataset.collectionId || '', downPass: password.value.trim()});
        if (!section.controller.signal.aborted) save(result.content, section.all('[data-down-name]').find(item => item.dataset.downName === id)?.textContent || 'download');
    }));
}

function passport(section) {
    const panel = name => section.all('[data-panel]').forEach(item => show(item, item.dataset.panel === name));
    const values = form => Object.fromEntries([...form.querySelectorAll('[name]')].map(control => [control.name, control.value]));
    const authorize = data => {
        if (!data || section.controller.signal.aborted) return;
        global.localStorage.setItem('HeyMyShop', JSON.stringify(data));
        const url = new URL(new URL(global.location.href).searchParams.get('ref') || section.runtime.config.prefix, global.location.href);
        global.location.assign(url.origin === global.location.origin ? url.href : section.runtime.config.prefix);
    };
    section.delegate('click', '[data-action]', (event, target) => { event.preventDefault(); if (['login', 'register', 'forget'].includes(target.dataset.action)) panel(target.dataset.action); });
    section.delegate('submit', '[data-form="login"], [data-form="register"]', guarded(section, async (event, form) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const button = form.querySelector('[type="submit"]'); if (button) button.disabled = true;
        try { authorize(await request(section, `/api/passport/client/${form.dataset.form}`, values(form))); }
        finally { if (button) button.disabled = false; }
    }));
    const form = section.one('[data-form="forget"]');
    section.delegate('click', '#getForgetCode', guarded(section, async event => {
        event.preventDefault();
        const email = form?.querySelector('[name="account"]');
        if (!email?.reportValidity()) return;
        await request(section, '/api/passport/client/code', {code: 'forget', title: 'Password reset', userName: email.value, account: email.value});
        if (section.controller.signal.aborted) return;
        section.one('#forgetNext').dataset.code = 'sent';
        notice(section, '验证码已发送 / Verification code sent');
    }));
    section.delegate('click', '#forgetNext', (event, button) => {
        event.preventDefault();
        if (button.dataset.code !== 'sent') { notice(section, '请先获取验证码 / Request a code first'); return; }
        if (![...form.querySelectorAll('[name="account"], [name="code"]')].every(control => control.reportValidity())) return;
        section.one('#forgetOne')?.classList.remove('show'); section.one('#forgetTwo')?.classList.add('show');
    });
    section.delegate('click', '#submitChangePassword', guarded(section, async event => {
        event.preventDefault();
        const data = values(form);
        if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9~!@#$%^&*]{6,16}$/.test(data.password || '')) throw new Error('密码需为 6–16 位，并包含字母和数字');
        if (data.password !== data.confirmPassword) throw new Error('两次密码不一致 / Passwords differ');
        await request(section, '/api/passport/client/forget', data);
        if (section.controller.signal.aborted) return;
        form.reset(); panel('login');
        section.one('#forgetOne')?.classList.add('show'); section.one('#forgetTwo')?.classList.remove('show');
    }));
    section.delegate('click', '.login-with-google', guarded(section, async event => {
        event.preventDefault();
        const data = await request(section, '/api/passport/google/auth', {});
        if (!section.controller.signal.aborted) global.location.assign(safeUrl(data.content));
    }));
    const query = new URL(global.location.href).searchParams;
    if (['login', 'register', 'forget'].includes(query.get('action'))) panel(query.get('action'));
    if (query.get('code') && query.get('prompt') === 'consent' && !section.runtime.config.preview) guarded(section, async () => authorize(await request(section, '/api/passport/google/authorized', {code: query.get('code'), prompt: 'consent'})))();
}

Object.assign(fo.behaviors, {productFilter, search, pagination, downloads, passport});
export {safeUrl};
