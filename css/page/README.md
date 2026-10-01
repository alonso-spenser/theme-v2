# 页面全局设计应用层

这层 CSS 是系统全局配置的实际使用，不是另一套组件框架。

基于 `section/css/base.scss` 及其导入文件整理，纯 CSS 变量驱动，无 Java / Thymeleaf 表达式。入口 `base.scss` 在编译时合入 `global-variables.scss`，生成 `base.css` / `base.min.css`；浏览器不会额外请求变量文件。

加载顺序：

```html
<link rel="stylesheet" href="../../css/base.css">
<link rel="stylesheet" href="../../css/page/base.css">
<link rel="stylesheet" href="./section.css">
```

## 文件职责

- `global-variables.scss`：系统配置值的唯一来源，沿用 `fox.theme_schema` 提取值，不使用旧 demo 的绿色主题、Cinzel 等测试默认值。
- `_bootstrap-theme.scss`：将全局配置映射为 Bootstrap 的 body、边框、表单、标题及按钮变量。已从框架入口移到本层，不重复定义。
- `_typography.scss`：大标题、标题、副标题、菜单、正文、内容标题及移动端字号。
- `_common.scss`：区块间距、卡片外观、侧栏、面包屑和标签的全局设计规则。不提供 Bootstrap 未引入模块的完整组件功能。
- `_title.scss`：标题区块及分隔线。
- `base.scss`：合入默认值及以上规则，补充页面正文和业务按钮。

修改配置值后运行 `node css/build.mjs`；前端即时预览则修改当前页面 `document.documentElement.style.setProperty('--colorTheme', '#0055ff')`，无需重新渲染 Java 模板。字体尺寸变量为数字，消费时使用 `calc(... * 1px)`。

## 与旧版区别

- 旧 `font-size: var(--colorBody)` 是颜色误用，已修为字号变量。
- 不再给所有 `div` 强制设置字体、字号和颜色，使用继承及明确的文字角色，避免干扰按钮和组件。
- 不复制旧 `.btn::after` 悬停机制；使用 Bootstrap 5 按钮状态变量。
- 桌面断点为 `min-width: 768px`，手机为 `max-width: 767.98px`，避免两个区间重叠。
- 不迁入 Slick 样式和 `FvyQV3` 专属组件样式；它们不属于页面全局设计层。
- Bootstrap 基础 H1–H6 层级保留，旧全局 H1 字号映射及 `text-*` 设计角色按原配置消费。

当前已接入 `imageText/KjbTA8/index.html`、`css/demo.html` 和 Java 组件预览。Java 预览按框架 → 页面全局设计 → 组件顺序加载 CSS，直接编译 SCSS，并把 `css` 纳入热刷新检测；修改变量无需手动构建。静态 DEMO 仍需运行构建命令或使用 IDE Sass watcher。现有组件自己的硬编码样式尚未批量替换。
