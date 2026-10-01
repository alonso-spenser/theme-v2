# V2 精简基础 CSS

基于 [Bootstrap 5.3.8](https://getbootstrap.com/docs/5.3/) 官方 npm 包（MIT）。原始 Sass 与许可证在 `vendor/bootstrap`，保留上游源码便于升级，但只有 `base.scss` 选中的模块会进入产物。没有引入 Bootstrap JavaScript 或 Popper。

```sh
npm run css:build
npm run css:watch # 监听 V2 SCSS，更新普通版和压缩版
node css/test.mjs
```

页面按顺序加载：

```html
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/page/base.css">
<!-- 组件自己的 section.css 放最后 -->
```

## 保留范围

- Root + Reboot：CSS 变量与基础浏览器样式统一。
- `.container`、`.container-sm/md/lg/xl/xxl`、`.container-fluid`。
- 项目扩展 `.container-full`：100% 宽度，保留默认左右 gutter；`.container-full.g-0` 为无边距全宽。
- `.row`、`.col`、`.col-auto`、`.col-1` 至 `.col-12`、`row-cols-*`、`offset-*`，全部响应式断点。
- `.g-*`、`.gx-*`、`.gy-*` 栅格间距；少量响应式 display/flex/对齐/order/gap 布局类。
- 表单输入、textarea、select、checkbox、radio、switch、range、file、input-group、floating label、验证提示和禁用态。
- 系统配置的实际使用已移至独立的 [page 全局设计层](page/README.md)，该层合入 `page/global-variables.scss` 并映射到正文、标题、按钮等规则；框架本身只负责 Bootstrap 基础能力。校验成功/失败、focus ring 等仍采用 Bootstrap 默认颜色。

保留按钮模块（实色、outline、尺寸、禁用态）和排版模块（H1–H6、`.h1`–`.h6`、display、lead 等）。标题字体/颜色/字重接入全局变量，字号保留 Bootstrap 的层级与响应式缩放；主按钮和主描边按钮接入全局按钮颜色。

不包含导航、菜单、弹窗、轮播、卡片、表格、完整 utilities、暗色模式或 JS 交互。Reboot 会重置这些 HTML 元素的默认样式，但不会生成相应组件类。表单 input-group 中仍有针对 dropdown 的组合选择器，不代表引入了 dropdown 模块。

## 文字工具类兼容

`vendor/bootstrap/scss/_text.scss` 基于 Bootstrap 5.3.8 utilities API 生成文字对齐、大小写、字重、字号、行高和文字颜色工具类，合入 `base.css` / `base.min.css`。保留旧 `css/utilities/text.scss` 的类名：`text-center`、响应式 `text-*-center/left/right`、`text-justify`、`text-nowrap`、`text-truncate`、`text-monospace`、`font-weight-light/normal/bold`、`font-italic`、文字颜色以及 `text-hide`。同时可使用新版 `text-start/end`、`fw-*`、`fst-*` 等名称。无需修改旧模板中的文字工具类；上游 Bootstrap 源码保持原样。

## 断点和容器

| 断点 | 起始宽度 | container 最大宽度 |
| --- | --- | --- |
| xs | 0 | 100% |
| sm | 576px | 540px |
| md | 768px | 720px |
| lg | 992px | 960px |
| xl | 1200px | 1140px |
| xxl | 1400px | 1320px |

除上述文字工具类外，其余仍采用新版组件约定：`.no-gutters` 改成 `.g-0`，`.custom-select` 改成 `.form-select`，`.custom-control` 改成 `.form-check`，不保留 `.form-group`/`.form-row`。表单布局用 row/col。原 `css/` 未修改；Java 预览已切换为此新版框架和 page 全局样式。预览框架响应还合入 `js/sections.css` 的原生运行时交互样式，不增加独立请求。依赖其他旧 Bootstrap 组件类名的组件仍需逐个适配。

[查看独立栅格及表单 DEMO](http://127.0.0.1:9030/css/demo.html)。
