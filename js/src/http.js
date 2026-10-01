import {fo, global} from './core.js';

class HttpError extends Error {
    constructor(message, {status = 0, data = null, response = null} = {}) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.data = data;
        this.response = response;
    }
}

class HttpClient {
    constructor(runtime) {
        this.runtime = runtime;
    }

    get config() {
        return this.runtime.config;
    }

    getToken() {
        if (typeof this.config.getToken === 'function') {
            return this.config.getToken() || '';
        }

        try {
            const user = JSON.parse(global.localStorage.getItem('HeyMyShop') || 'null');
            return user?.token || '';
        } catch {
            return '';
        }
    }

    resolveUrl(path, base = this.config.apiBase) {
        if (/^https?:\/\//i.test(path) || !base) return path;
        return new URL(path, new URL(base, global.location.href)).toString();
    }

    addQuery(url, query) {
        if (!query) return url;

        const parsed = new URL(url, global.location.href);
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                parsed.searchParams.set(key, String(value));
            }
        });

        return /^https?:\/\//i.test(url)
            ? parsed.toString()
            : parsed.pathname + parsed.search + parsed.hash;
    }

    createHeaders(headers = {}) {
        return {
            Accept: 'application/json',
            siteId: this.config.siteId || '',
            token: this.getToken(),
            os: /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(global.navigator.userAgent) ? '1' : '0',
            region: this.config.lang || 'en',
            app: String(this.config.app || 5000),
            ...headers
        };
    }

    createBody(data, headers) {
        if (data === undefined || data === null) return undefined;
        if (data instanceof global.FormData || data instanceof global.Blob || typeof data === 'string') {
            return data;
        }

        headers['Content-Type'] ||= 'application/json';
        return JSON.stringify(data);
    }

    async parseResponse(response, responseType = 'auto') {
        if (response.status === 204) return null;
        if (responseType === 'text') return response.text();
        if (responseType === 'blob') return response.blob();

        const text = await response.text();
        if (!text) return null;
        const contentType = response.headers.get('content-type') || '';
        const parseJson = responseType === 'json' || contentType.includes('json');
        return parseJson ? JSON.parse(text) : text;
    }

    async request(path, options = {}) {
        const {
            method = 'GET',
            data,
            query,
            headers: customHeaders,
            responseType = 'auto',
            timeout = this.config.requestTimeout,
            credentials = 'same-origin',
            base = this.config.apiBase,
            signal
        } = options;

        const requestMethod = method.toUpperCase();
        const url = this.addQuery(this.resolveUrl(path, base), query);
        const headers = this.createHeaders(customHeaders);
        const body = requestMethod === 'GET' || requestMethod === 'HEAD'
            ? undefined
            : this.createBody(data, headers);
        const controller = new global.AbortController();
        const abort = () => controller.abort();
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, {once: true});
        const timeoutId = timeout > 0
            ? global.setTimeout(() => controller.abort(), timeout)
            : null;

        try {
            const response = await global.fetch(url, {
                method: requestMethod,
                headers,
                body,
                credentials,
                signal: controller.signal
            });
            const result = await this.parseResponse(response, responseType);

            if (!response.ok) {
                throw new HttpError(
                    result?.message || `HTTP ${response.status}`,
                    {status: response.status, data: result, response}
                );
            }
            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                if (signal?.aborted) throw error;
                throw new HttpError('Request timeout');
            }
            throw error;
        } finally {
            if (timeoutId) global.clearTimeout(timeoutId);
            signal?.removeEventListener('abort', abort);
        }
    }

    get(path, query, options = {}) {
        return this.request(path, {...options, method: 'GET', query});
    }

    post(path, data, options = {}) {
        return this.request(path, {
            responseType: 'json',
            ...options,
            method: 'POST',
            data
        });
    }
}

fo.http = new HttpClient(fo);

export {HttpClient, HttpError};
