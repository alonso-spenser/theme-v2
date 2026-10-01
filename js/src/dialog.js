import {document, emit, fo, global} from './core.js';

const defaults = {
    id: '',
    title: '',
    content: '',
    width: '',
    containerClass: '',
    cancelText: '',
    confirmText: '',
    closable: true,
    centered: true,
    onConfirm: null,
    onCancel: null
};

const setContent = (element, content) => {
    if (content instanceof global.Node) {
        element.appendChild(content);
        return;
    }
    element.innerHTML = content == null ? '' : String(content);
};

class Dialog {
    constructor(runtime, options = {}) {
        this.runtime = runtime;
        this.options = {...defaults, ...options};
        this.element = null;
        this.timer = null;
        this.handleClick = this.handleClick.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
    }

    render() {
        const root = document.createElement('div');
        root.className = `section-dialog${this.options.centered ? ' middle' : ''}`;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('tabindex', '-1');
        if (this.options.id) root.id = this.options.id;

        const container = document.createElement('div');
        container.className = ['section-dialog-container', this.options.containerClass]
            .filter(Boolean)
            .join(' ');
        if (this.options.width) container.style.width = this.options.width;

        if (this.options.title || this.options.closable) {
            container.appendChild(this.renderHeader(root));
        }

        const content = document.createElement('div');
        content.className = 'section-dialog-content';
        setContent(content, this.options.content);
        container.appendChild(content);

        if (this.options.cancelText || this.options.confirmText) {
            container.appendChild(this.renderFooter());
        }

        root.appendChild(container);
        this.element = root;
        return root;
    }

    renderHeader(root) {
        const header = document.createElement('div');
        header.className = 'section-dialog-header';

        if (this.options.title) {
            const title = document.createElement('div');
            const titleId = `${this.options.id || `fo-dialog-${Date.now()}`}-title`;
            title.className = 'section-dialog-title';
            title.id = titleId;
            title.textContent = this.options.title;
            header.appendChild(title);
            root.setAttribute('aria-labelledby', titleId);
        }

        if (this.options.closable) {
            const close = document.createElement('span');
            close.className = 'section-dialog-close';
            close.dataset.dialogAction = 'cancel';
            close.setAttribute('role', 'button');
            close.setAttribute('tabindex', '0');
            close.setAttribute('aria-label', this.runtime.i18n.t('dialog.close'));
            header.appendChild(close);
        }
        return header;
    }

    renderFooter() {
        const footer = document.createElement('div');
        footer.className = 'section-dialog-footer';

        if (this.options.cancelText) {
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn';
            cancel.dataset.dialogAction = 'cancel';
            cancel.textContent = this.options.cancelText;
            footer.appendChild(cancel);
        }

        if (this.options.confirmText) {
            const confirm = document.createElement('button');
            confirm.type = 'button';
            confirm.className = 'btn btn-primary';
            confirm.dataset.dialogAction = 'confirm';
            confirm.textContent = this.options.confirmText;
            footer.appendChild(confirm);
        }
        return footer;
    }

    async handleClick(event) {
        const control = event.target.closest('[data-dialog-action]');
        if (!control || !this.element.contains(control)) return;

        if (control.dataset.dialogAction === 'confirm') {
            await this.confirm();
            return;
        }
        this.close('cancel');
    }

    handleKeydown(event) {
        if (event.key === 'Escape' && this.options.closable) {
            event.preventDefault();
            this.close('cancel');
            return;
        }

        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-dialog-action]')) {
            event.preventDefault();
            event.target.click();
        }
    }

    open() {
        if (!this.element) this.render();
        document.body.appendChild(this.element);
        document.body.classList.add('section-dialog-overflow');
        this.element.addEventListener('click', this.handleClick);
        this.element.addEventListener('keydown', this.handleKeydown);
        this.element.focus({preventScroll: true});
        emit(this.element, 'fo:dialog-open', {dialog: this});
        return this;
    }

    async confirm() {
        if (!this.element) return false;
        if (typeof this.options.onConfirm !== 'function') {
            this.close('confirm');
            return true;
        }

        const button = this.element.querySelector('[data-dialog-action="confirm"]');
        if (button?.disabled) return false;
        if (button) {
            button.disabled = true;
            button.classList.add('section-loading-button');
        }

        try {
            const valid = await this.options.onConfirm(this);
            if (valid === true) this.close('confirm');
            return valid === true;
        } catch (error) {
            console.error('[fo.dialog] Confirmation failed', error);
            emit(this.element, 'fo:dialog-confirm-error', {dialog: this, error});
            return false;
        } finally {
            if (this.element && button) {
                button.disabled = false;
                button.classList.remove('section-loading-button');
            }
        }
    }

    close(action = 'close') {
        if (!this.element) return;
        const element = this.element;

        global.clearTimeout(this.timer);
        element.removeEventListener('click', this.handleClick);
        element.removeEventListener('keydown', this.handleKeydown);
        this.runtime.unmount(element);
        element.remove();

        if (!document.querySelector('.section-dialog')) {
            document.body.classList.remove('section-dialog-overflow');
        }
        if (action === 'cancel') this.options.onCancel?.(this);
        emit(document, 'fo:dialog-close', {dialog: this, action});
        this.element = null;
    }

    closeAfter(seconds = 3) {
        global.clearTimeout(this.timer);
        this.timer = global.setTimeout(() => this.close('timeout'), seconds * 1000);
        return this;
    }
}

class DialogManager {
    constructor(runtime) {
        this.runtime = runtime;
    }

    open(options = {}) {
        return new Dialog(this.runtime, options).open();
    }

    loading(options = {}) {
        const dialog = new Dialog(this.runtime, {
            ...options,
            title: '',
            content: '',
            closable: false
        });
        dialog.render();
        dialog.element.querySelector('.section-dialog-container').classList.add('section-dialog-loading');
        dialog.element.querySelector('.section-dialog-content').classList.add(
            'section-loading-dark',
            'section-loading-transparent'
        );
        return dialog.open();
    }

    video({src, title = 'Video', ...options}) {
        const wrapper = document.createElement('div');
        const iframe = document.createElement('iframe');
        wrapper.className = 'embed-responsive embed-responsive-video';
        iframe.className = 'embed-responsive-item';
        iframe.src = src;
        iframe.title = title;
        iframe.allowFullscreen = true;
        wrapper.appendChild(iframe);

        return this.open({
            ...options,
            title,
            content: wrapper,
            containerClass: 'section-dialog-video',
            centered: true
        });
    }
}

fo.dialog = new DialogManager(fo);

export {Dialog, DialogManager};
