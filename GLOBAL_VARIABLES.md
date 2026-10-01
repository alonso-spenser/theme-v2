# 全局 CSS 变量

`css/page/global-variables.scss` 从 `fox.theme_schema` 的颜色、字体、通用设置提取，共 47 项。以 `global_*_data` 当前值为准，缺失时才取 Schema 默认值。数据库未修改。

## 引用与使用

标准开发页面引用页面全局设计层（已编译合入变量定义，不再单独请求变量文件）：

```html
<link rel="stylesheet" href="../../css/base.css">
<link rel="stylesheet" href="../../css/page/base.css">
<link rel="stylesheet" href="./section.css">
```

变量定义本身不会改变页面外观。组件要使用 `var()` 才能随全局配置变化，例如：

```css
.example-heading {
  color: var(--colorHeading);
  font-family: var(--typeHeading);
  font-weight: var(--weightHeading);
  font-size: calc(var(--fontSizeHeading) * 1px);
}
.example-button {
  background: var(--colorButton);
  color: var(--colorButtonLabel);
  border-radius: var(--borderRadius);
  padding-inline: calc(var(--buttonPadding) * 1px);
}
@media (max-width: 768px) {
  .example-heading { font-size: calc(var(--fontSizeHeadingMob) * 1px); }
}
```

所有数字型尺寸保持原始数字，以便编辑器沿用数值控件；不要向这些变量写入 `px`。`borderRadius` 原本是 `0.25rem`，保留单位并直接使用。`weightHeading` 是 `normal`/`bold`。字体值为 CSS 字体栈，不是 `Google_*` 之类的资源标识；更换网络字体还需另行加载字体资源。

## 前端实时修改

```js
const root = document.documentElement;
root.style.setProperty('--colorTheme', '#0055ff');
root.style.setProperty('--fontSizeBody', '18');
root.style.setProperty('--borderRadius', '8px');
// 清除临时覆盖，恢复文件中的默认值：
root.style.removeProperty('--colorTheme');
```

只改变当前文档，不会自动保存数据库。iframe 预览应在 iframe 内部文档的根元素上设置变量；外层导航页面的变量不会跨文档继承。组件局部可以用 `.my-section { --colorTheme: ...; }` 覆盖，同页其他组件不受影响。

## 本次范围

- 提取颜色 17 项、字体 19 项、通用外观 11 项，并保留原字段名。
- 排除 `dataset`、`sectionAlias` 等编辑器元信息；favicon、社交链接、语言和页面布局仍属于 HTML/数据配置，不转换为 CSS 变量。
- 变量文件仅提供配置值；[页面全局设计层](css/page/README.md) 参考旧 `section/css/base.scss` 实现这些值的实际使用，编译时合入本文件。SLB 静态 DEMO 按框架 CSS → 页面全局设计 CSS → 组件 CSS 的顺序引用；组件 SCSS 不重复合入全局变量。旧插件和特定组件规则不进入该层，未批量改写现有组件样式。
- Java 预览后台已接入页面全局样式并实时编译、检测样式文件变化。现有组件将硬编码值替换为变量仍是后续工作；接入全局层不代表这些组件已全部迁移。
