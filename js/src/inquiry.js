import {document, emit, findElements, fo, global} from './core.js';

class InquiryService {
    constructor(runtime) {
        this.runtime = runtime;
        this.boundForms = new WeakMap();
        this.boundTriggers = new WeakMap();
    }

    mount(root = document) {
        this.mountPopups(root);
        findElements(root, '[data-inquiry-form]').forEach((form) => this.mountForm(form));
    }

    mountForm(form, onSubmit = null) {
        if (!form || this.boundForms.has(form)) return;
        const controller = new global.AbortController();
        this.boundForms.set(form, controller);
        const options = {signal: controller.signal};

        form.querySelectorAll('input[type="file"]').forEach((input) => {
            input.addEventListener('change', () => this.updateFileDisplay(input), options);
        });

        form.querySelectorAll('.file-upload-selected > label').forEach((removeButton) => {
            removeButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.clearFile(removeButton);
            }, options);
        });

        form.addEventListener('submit', onSubmit || ((event) => this.handleSubmit(event, form)), options);
    }

    unmount(root) {
        for (const [selector, map] of [['[data-inquiry-form]', this.boundForms], ['[data-popup-enquiry]', this.boundTriggers]]) {
            findElements(root, selector).forEach(element => { map.get(element)?.abort(); map.delete(element); });
        }
    }

    updateFileDisplay(input) {
        const wrapper = input.closest('.file-upload, .form-group') || input.parentElement;
        const selected = wrapper?.querySelector('.file-upload-selected');
        const placeholder = wrapper?.querySelector('.file-upload-placeholder');
        const name = input.files?.[0]?.name || '';

        selected?.classList.toggle('active', Boolean(name));
        placeholder?.classList.toggle('hide', Boolean(name));
        const label = selected?.querySelector('p');
        if (label) label.textContent = name;
    }

    clearFile(removeButton) {
        const wrapper = removeButton.closest('.file-upload, .form-group');
        const input = wrapper?.querySelector('input[type="file"]');
        if (input) input.value = '';
        wrapper?.querySelector('.file-upload-selected')?.classList.remove('active');
        wrapper?.querySelector('.file-upload-placeholder')?.classList.remove('hide');
    }

    validateControl(control) {
        const valid = control.checkValidity();
        control.classList.toggle('is-valid', valid);
        control.classList.toggle('is-invalid', !valid);

        return {
            valid,
            value: typeof control.value === 'string' ? control.value.trim() : control.value,
            field: control.dataset.field || '',
            name: control.name || control.dataset.field || ''
        };
    }

    collect(form) {
        const fields = {};
        const files = [];
        const identity = {firstName: '', lastName: '', email: '', phone: ''};

        form.classList.add('was-validated');
        form.querySelectorAll('.form-control').forEach((control) => {
            if (control.type === 'file') {
                files.push(...control.files);
                return;
            }

            const result = this.validateControl(control);
            if (result.name) {
                if (fields[result.name] === undefined) {
                    fields[result.name] = result.value;
                } else if (Array.isArray(fields[result.name])) {
                    fields[result.name].push(result.value);
                } else {
                    fields[result.name] = [fields[result.name], result.value];
                }
            }
            if (result.field in identity) {
                identity[result.field] = result.value;
            }
        });

        form.querySelectorAll('.inquiry-form-group').forEach((group) => {
            const heading = group.querySelector('h5')?.textContent.trim();
            if (!heading) return;
            fields[heading] = [...group.querySelectorAll('input:checked')].map((input) => input.value);
        });

        const imageMeta = document.querySelector('meta[property="fo:image"]');
        const payload = {
            refTitle: document.title,
            refUrl: global.location.href,
            refImg: imageMeta?.content || '',
            email: identity.email,
            phone: identity.phone,
            siteId: this.runtime.config.siteId,
            content: JSON.stringify(fields),
            formId: form.dataset.inquiryForm || '',
            lastName: identity.lastName,
            firstName: identity.firstName,
            ...this.collectMeta()
        };

        return {valid: form.checkValidity(), payload, fields, files};
    }

    collectMeta() {
        return [...document.querySelectorAll('meta[property^="fo:tag"]')].reduce((result, meta) => {
            const [, module, key] = meta.getAttribute('property').split(':');
            if (module && key) {
                result.moduleType = module;
                result[key] = meta.content || '';
            } else if (module) {
                result[module] = meta.content || '';
            }
            return result;
        }, {});
    }

    setSubmitting(form, submitting) {
        form.querySelectorAll('[type="submit"]').forEach((button) => {
            button.disabled = submitting;
            button.classList.toggle('section-loading-button', submitting);
        });
    }

    async uploadAttachment(file) {
        const data = new global.FormData();
        data.append('file', file);
        data.append('rename', 'true');
        data.append('siteId', this.runtime.config.siteId || '');
        data.append('dir', `${this.runtime.config.siteId || ''}/annex`);

        const result = await this.runtime.http.post('/api/file/upload', data, {
            base: this.runtime.config.fileApiBase || this.runtime.config.apiBase
        });
        return result?.data?.url || '';
    }

    handleSubmit(event, form) {
        event.preventDefault();
        event.stopPropagation();

        return this.submit(form);
    }

    async submit(form) {
        if (!form) return false;
        if (this.runtime.config.preview) {
            const text = document.createElement('p');
            text.textContent = '预览模式不提交询盘 / Preview does not submit inquiries';
            this.runtime.dialog.open({content: text});
            return false;
        }

        const submission = this.collect(form);
        if (!submission.valid) return false;
        this.setSubmitting(form, true);

        try {
            if (submission.files.length) {
                submission.fields.Attachment = await this.uploadAttachment(submission.files[0]);
                submission.payload.content = JSON.stringify(submission.fields);
            }

            const result = await this.runtime.http.post('/api/enquiry/consult', submission.payload, {signal: this.boundForms.get(form)?.signal});
            if (result?.success === false) throw new Error(result.message || 'Inquiry failed');
            emit(form, 'fo:inquiry-success', {result, payload: submission.payload});
            return true;
        } catch (error) {
            console.error('[fo.inquiry] Submission failed', error);
            emit(form, 'fo:inquiry-error', {error});
            return false;
        } finally {
            this.setSubmitting(form, false);
        }
    }

    mountPopups(root) {
        findElements(root, '[data-popup-enquiry]').forEach((trigger) => {
            if (this.boundTriggers.has(trigger)) return;
            const controller = new global.AbortController();
            this.boundTriggers.set(trigger, controller);
            trigger.addEventListener('click', (event) => this.openPopup(event, trigger), {signal: controller.signal});
        });
    }

    async openPopup(event, trigger) {
        event.preventDefault();
        const id = trigger.dataset.popupEnquiry;
        if (!id) return;
        let loading = null;

        try {
            loading = this.runtime.dialog.loading();
            let path = String(this.runtime.config.formsPath || 'forms').replace(/\/$/, '');
            if (!/^https?:\/\//i.test(path) && !path.startsWith('/')) {
                path = `${String(this.runtime.config.prefix || '/').replace(/\/?$/, '/')}${path}`;
            }
            let source = await this.runtime.http.get(`${path}/${encodeURIComponent(id)}.html`, null, {
                base: '',
                responseType: 'text'
            });

            loading?.close();
            const dialog = this.runtime.dialog.open({
                width: '480px',
                title: trigger.dataset.title || fo.i18n.t('inquiry'),
                confirmText: fo.i18n.t('save'),
                cancelText: fo.i18n.t('cancel'),
                content: source,
                centered: true,
                closable: true,
                onConfirm: (currentDialog) => {
                    const form = currentDialog.element.querySelector('form');
                    return this.submit(form);
                }
            });

            const form = dialog.element.querySelector('form');
            this.mountForm(form, (submitEvent) => {
                submitEvent.preventDefault();
                submitEvent.stopPropagation();
                dialog.confirm();
            });
            this.runtime.mount(dialog.element);
        } catch (error) {
            loading?.close();
            console.error('[fo.inquiry] Failed to load popup', error);
            emit(trigger, 'fo:inquiry-error', {error});
        }
    }
}

fo.inquiry = new InquiryService(fo);

export {InquiryService};
