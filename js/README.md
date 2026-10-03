# FO Runtime v2

这是一个不依赖 jQuery、使用 ES6+ 模块和 Class 完全重构的实验性基础框架，目前包含：

- `fo.init(config)`：保存全局配置并挂载页面。
- `fo.register(name, Component)`：注册组件。
- `fo.mount(root)` / `fo.unmount(root)`：挂载或销毁动态内容。
- `fo.http`：基于 Fetch 的请求、JSON POST、询盘提交和文件上传。
- `fo.i18n`：轻量多语言服务，支持点路径、语言包扩展和变量插值。
- `fo.dialog`：`DialogManager` 实例，提供普通弹窗、加载弹窗和视频弹窗。
- `fo.inquiry`：询盘表单绑定、校验、数据整理、提交和弹窗内容加载。

组件公共交互现在由 `section.js`、`behaviors.js`、`catalog-behaviors.js` 提供：原生滚动轮播、图片懒加载、数字动画、导航/选项卡、相册/视频、筛选/搜索、下载与账户表单。所有事件、定时器与观察器按组件实例清理，不提供 jQuery 兼容接口。

`fo.Section` 提供 `on`、`delegate`、`interval`、`cleanup`、`dialog` 和 `destroy`。组件继承它后调用 `runtime.behaviors.common(this)`，再安装自身需要的行为。页面同时加载 `sections.css`。预览的 `preview: true` 禁止实际业务提交；不是生产 API 模拟器。

## 源码与打包

开发源码位于 `src/`：

```text
src/
├── core.js       # fo.init 与组件生命周期
├── i18n.js       # 轻量多语言服务
├── http.js       # Fetch 请求
├── dialog.js     # 弹窗
├── inquiry.js    # 询盘表单
└── index.js      # 打包入口
```

构建同时生成开发版 `base.js`、压缩版 `base.min.js` 和各自的 `.map` 文件，不应直接手工修改。生产页面可以使用 `base.min.js`；两者功能和加载顺序相同，只需引用其中一个。
`example.html` 是可以直接用于检查组件挂载和弹窗行为的本地示例。

在仓库根目录执行：

```bash
npm install
npm run js:build
```

开发时监听源码变化（同步更新普通版和压缩版）：

```bash
npm run js:watch
```

## 页面加载

```html
<script src="/js/base.js"></script>
<script src="/sections.js"></script>
<script>
  fo.init({
    siteId: '1889871748994981890',
    title: 'fomille',
    lang: 'en',
    prefix: '/',
    apiBase: ''
  });
</script>
```

`base.js` 应在组件注册代码之前加载，`fo.init()` 应在组件代码加载之后调用。

## 组件

组件使用 Class，并通过 `fo.register` 注册：

```js
class Header {
  constructor(element, runtime) {
    this.element = element;
    this.runtime = runtime;
    this.toggler = element.querySelector('.navbar-toggler');
    this.menu = element.querySelector('.NJ3YJ3-menu');
    this.handleToggle = () => this.menu?.classList.toggle('active');
    this.toggler?.addEventListener('click', this.handleToggle);
  }

  destroy() {
    this.toggler?.removeEventListener('click', this.handleToggle);
  }
}

fo.register('NJ3YJ3', Header);
```

动态插入 HTML 后调用：

```js
container.insertAdjacentHTML('beforeend', html);
fo.mount(container);
```

## HTTP

所有方法返回原生 Promise：

```js
const result = await fo.http.post('/api/example', { id: 1 });

const list = await fo.http.get('/api/example', { page: 1 });

const result2 = await fo.http.request('/api/example', {
  method: 'PUT',
  data: { title: 'Example' },
  responseType: 'json'
});
```

非 2xx 响应会抛出 `HttpError`。不提供 jQuery 式兼容接口。

## I18n

`fo.init({ lang })` 会自动设置当前语言。支持 `cn`、`zh-CN` 等常见中文别名：

```js
fo.init({ lang: 'zh-CN' });

fo.i18n.t('networkError');
fo.i18n.t('default.success');
```

运行时追加语言包：

```js
fo.i18n.add('en', {
  welcome: 'Hello, {{user.name}}!'
});

fo.i18n.t('welcome', {
  user: { name: 'Joe' }
});

fo.i18n.setLocale('zh');
```

## Dialog

Dialog 使用新的 Manager API：

```js
const dialog = fo.dialog.open({
  title: '提示',
  content: '<p>确定继续吗？</p>',
  confirmText: '确定',
  cancelText: '取消',
  width: '480px',
  onConfirm: async () => {
    const valid = await validateData();
    return valid; // 只有严格返回 true 才会关闭弹窗
  },
  onCancel: () => console.log('cancelled')
});

dialog.close();
```

`onConfirm` 支持同步或异步验证。返回 `true` 时关闭弹窗；返回其它值或抛出异常时保留弹窗。没有配置 `onConfirm` 时，点击确认会直接关闭。

加载与视频弹窗：

```js
const loading = fo.dialog.loading();
loading.close();

fo.dialog.video({
  src: 'https://example.com/video',
  title: 'Video'
});
```

支持 `Escape` 关闭，并派发 `fo:dialog-open` 和 `fo:dialog-close` 事件。

## Inquiry

现有的基础 HTML 协议继续使用：

```html
<form data-inquiry-form="FORM_ID" novalidate>
  <input
    class="form-control"
    type="email"
    name="Email"
    data-field="email"
    required
  >
  <button type="submit">Submit</button>
</form>
```

可监听以下事件接入页面 UI、埋点或跳转：

```js
document.addEventListener('fo:ready', event => {});

document.addEventListener('fo:inquiry-success', event => {
  console.log(event.detail.result);
});

document.addEventListener('fo:inquiry-error', event => {
  console.error(event.detail.error);
});

```

通过 `[data-popup-enquiry]` 打开的询盘表单由 Dialog 的 `onConfirm` 统一处理：表单校验或提交失败时返回 `false` 并保留弹窗，提交成功时返回 `true` 并关闭弹窗。表单内按 Enter 也会进入同一确认流程。

这份代码是结构预览，不建议现在替换线上 `js/dist/base.js`。

## 图片大小图协议

上传参数 `thumbnail=true` 时，数据库保存 100×100 内等比小图地址 `name.webp`，正式图为 `name.og.webp`（2000×2000 内等比缩放）。非配对上传仍然保存正式图地址。

组件使用 `src` 放小图、`data-original` 或 `data-lazy` 放正式图。公共 `images.js` 使用 IntersectionObserver 在距离视口 300px 时预加载，成功后替换，失败保留占位图；组件销毁时断开观察器。无需添加 width/height。

Thymeleaf 渲染上下文需提供 `imageUrls`（mall 服务的 ImageUrls）：`thumbnail(url)` 返回小图，`original(url)` 返回正式图；背景、视频封面和放大链接直接使用正式图。不依赖本地主题仓库运行。修改后执行 `npm run js:build`，部署生成的 base.min.js 后生效。
