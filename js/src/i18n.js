import {fo} from './core.js';

const defaultResources = {
    zh: {
        oops: '提示',
        timeOut: '登录超时，请重新登录',
        networkError: '哎呀，服务器开小差了',
        dialog: {
            close: '关闭',
            confirm: '确定',
            cancel: '取消'
        },
        default: {
            failed: '操作失败',
            success: '操作成功'
        },
        cancel: '取消',
        save: '保存',
        confirm: '确认',
        inquiry: '联系我们'
    },
    en: {
        oops: 'OOPS',
        timeOut: 'Login timeout, please login again',
        networkError: 'OOPS, the server has deserted',
        dialog: {
            close: 'Close',
            confirm: 'Confirm',
            cancel: 'Cancel'
        },
        default: {
            failed: 'Operation failed',
            success: 'Operation succeeded'
        },
        cancel: 'Cancel',
        save: 'Save',
        confirm: 'Confirm',
        inquiry: 'Contact us'
    }
};

const localeAliases = {
    cn: 'zh',
    'zh-cn': 'zh',
    'zh-hans': 'zh',
    'en-us': 'en',
    'en-gb': 'en'
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const merge = (target, source) => {
    Object.entries(source).forEach(([key, value]) => {
        target[key] = isObject(value)
            ? merge(isObject(target[key]) ? target[key] : {}, value)
            : value;
    });
    return target;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

class I18n {
    constructor({locale = 'en', fallbackLocale = 'en', resources = {}} = {}) {
        this.resources = merge(clone(defaultResources), resources);
        this.fallbackLocale = this.normalizeLocale(fallbackLocale);
        this.locale = this.normalizeLocale(locale);
    }

    normalizeLocale(locale) {
        const normalized = String(locale || 'en').toLowerCase();
        return localeAliases[normalized] || normalized.split('-')[0];
    }

    setLocale(locale) {
        this.locale = this.normalizeLocale(locale);
        return this;
    }

    add(locale, messages) {
        const key = this.normalizeLocale(locale);
        this.resources[key] = merge(this.resources[key] || {}, messages);
        return this;
    }

    has(key, locale = this.locale) {
        return this.resolve(key, locale) !== undefined;
    }

    resolve(key, locale = this.locale) {
        return String(key)
            .split('.')
            .reduce((value, part) => value?.[part], this.resources[this.normalizeLocale(locale)]);
    }

    t(key, params = {}) {
        const value = this.resolve(key) ?? this.resolve(key, this.fallbackLocale);
        if (typeof value !== 'string') return '';

        return value.replace(/\{\{\s*([\w.-]+)\s*}}/g, (match, name) => {
            const replacement = name
                .split('.')
                .reduce((result, part) => result?.[part], params);
            return replacement ?? match;
        });
    }
}

fo.i18n = new I18n({locale: fo.config.lang});

export {defaultResources, I18n};
