# 主题与组件开发指南

> 本文件只保留当前 V2 规范，不包含旧版 ART、jQuery 或兼容迁移方案。

## V2 组件开发规范（当前生效）

本文是新版组件的开发约定。旧 ART 示例只用于解释结构和行为，不要求新版保留 ART 或 jQuery。开发顺序：静态 DEMO → 配置定义与 Java 模板 → 渲染及发布验证。

### 1. 页面、组件与实例

#### 旧组件静态 DEMO 恢复

- `section/{type}/{salt}/index.html` 保存真实渲染后的 HTML，不再只是预览跳转链接；使用本地演示 fixture，不代表线上店铺数据。
- 开发样式顺序为框架 `css/base.css` → 页面全局 `css/page/base.css` → 当前组件 `section.css`。组件 CSS 由 `section.scss` 编译，不能直接维护编译产物。
- 批量恢复的 DEMO 将实例参数样式存于 `_demo.scss`，由 `section.scss` 引入，选择器只作用于 `.section-demo-{salt}`；正式实例参数继续来自 `variable.th.css`。
- `node tools/check-static-demos.mjs` 检查根节点、残留模板语法、资源引用及 SCSS 编译，结果写入 `section/static-demo-verification.json`。这不等于所有视觉、交互及业务接口均已验收。
- 商城占位组件保留占位状态，不生成虚假的业务实现。组件索引分别提供静态 DEMO 与 Java 参数预览入口。

一个页面由页面外壳和多个组件实例组成。每个完整组件的最外层必须为 `<section>`：

```html
<section class="aENvYz section-1410131327550377986"
         data-section="aENvYz">
  <!-- 组件内容 -->
</section>
```

- `salt` / `data-section`：标识组件实现，与目录 `{section_type}/{salt}`、`templateId`、`fo.register(salt, Class)` 一致。不是页面实例 ID。
- 不输出 `data-section-type`。组件类型仅用于目录、manifest 和服务端数据组织，前端通过 `data-section` 的 salt 注册及挂载，无需重复输出类型属性。
- 根 class 中的 salt 是组件公用样式命名空间。salt 为随机、无业务含义的标识，不使用品牌或内容名称。
- 自定义子类使用 `{salt}-xxx`（如 `.KjbTA8-media`），不用品牌名或双下划线命名。通用类继续使用 Bootstrap/全局设计规范，且组件覆盖必须限定根作用域，如 `.KjbTA8 .text-small`、`.KjbTA8 img`；禁止裸写 `img`、`.card-body` 等全局覆盖。
- `section.sectionId`：业务来源是 `mall.shop_page_section.id`，标识页面中的具体实例。新版渲染上下文将其映射为 `section.id`，不得混用组件定义记录的 ID。
- `.section-{id}`：只影响这个实例的 CSS 参数作用域；同一组件在页面上重复出现时，salt 相同、实例 ID 不同。
- 不重复输出 `data-section-id`，实例定位使用 `.section-{id}` 类名；框架通过 DOM 元素维护独立实例，通过 `data-section` 识别组件实现。
- 根节点不输出 `data-runtime-version`，版本信息保留在 manifest 和渲染上下文中；不默认添加 `aria-labelledby`。组件根节点的基础约定只有 `class="{salt} section-{id}"` 和 `data-section="{salt}"`。表单 label、弹窗等实际交互需要的无障碍关联不受此约定影响。
- 数据库长 ID 以字符串处理，不转换成 JS Number。静态 DEMO 使用明确标注的 `demo-*` 模拟 ID，不冒充数据库记录。
- 标题、表单的 HTML `id` 也应包含实例 ID，避免重复组件间的 label/ARIA 冲突。
- 新增组件的 salt 为 6 位字母数字、首位字母，用数据库查重工具生成。当前演示组件为 `imageText/KjbTA8`。

### 2. CSS 分层和页面资源

正式发布页面只加载两份样式和两份外部脚本（图片、字体等资源不计入）：

| 资源 | 内容 | 缓存范围 |
| --- | --- | --- |
| framework.[hash].css | 精简 Bootstrap 5、系统级基础样式和设计变量消费规则 | 系统级 CDN |
| site.[hash].css | 网站全局变量值、全站使用到的组件公用 CSS、各实例 CSS 参数 | 网站级 CDN |
| framework.[hash].js | 原生 v2 Runtime、注册/挂载/卸载和系统能力 | 系统级 CDN |
| site.[hash].js | 全站使用的组件 JS 定义及一次页面初始化 | 网站级 CDN |

合并时每个 salt 的公用 CSS/JS 只收集一次；实例参数按真实实例 ID 分别生成。样式顺序为网站全局默认值 → 组件公用规则 → 实例覆盖。只发布网站实际使用的组件集合，不把开发目录所有组件无条件打包进去。

先加载 framework CSS 再加载 site CSS；JS 两个 script 都用 `defer`，保持 framework → site 的顺序，不用 `async`。site JS 完成注册后调用一次 `fo.init()`。站点 CSS 可以从框架 CSS 中引用的变量入手覆盖，无需重新编译系统资源。

正式资源必须实际合并，不能用 CSS `@import` 或 JS 动态加载假装合并。文件内容变化后生成新 hash；HTML 引用更新后的 URL，不覆盖长期缓存的同名资源。

目前这部分是发布目标：已有 Java 开发预览仍是多资源加载，不能宣称正式站点合并链路已经实现。当前已完成规范和第一个静态 DEMO，发布聚合链路另行实现。

### 3. 静态 DEMO

组件的 `index.html` 是模板转换前的完整 HTML，填充真实可见的示例内容，不含 ART/Thymeleaf 表达式，也不只是跳转链接。本地图片用相对路径，不依赖 Java 预览接口。

开发阶段 DEMO 显式引用框架、页面全局设计、组件三份 CSS，以及两份 JS，便于分别调试；页面全局设计已经包含变量定义。正式发布再按前述规则聚合为两份 CSS：

```html
<link rel="stylesheet" href="../../../css/base.css">
<link rel="stylesheet" href="../../../css/page/base.css">
<link rel="stylesheet" href="./section.css">
<script defer src="../../../js/base.js"></script>
<script defer src="./section.js"></script>
<script defer src="../../../js/demo.js"></script>
```

`section.css` 由 `section.scss` 编译，只包含组件样式，不重复合入全局变量。HTML 按 Bootstrap → 页面全局设计 → 组件 CSS 的顺序引用。`css/page/base.scss` 将 `global-variables.scss` 与正文、标题、按钮、间距等变量消费规则编译为一份 CSS，不需要额外请求变量文件。正式聚合构建将页面全局设计和组件样式在网站级入口合并一次。`（DEMO 专用入口）` 仅触发静态 DEMO 初始化，正常预览由页面外壳负责初始化。

不在 HTML 中复制组件 CSS；组件 SCSS 是样式源文件。无业务交互的组件不制造多余事件，保留原生框架注册即可。

### 4. 组件样式和全局设计

**样式复用顺序：Bootstrap → 全局设计 → 组件自定义。能不写就不写。** 先确认框架和全局规则是否已有对应能力，只有无法满足组件效果时才补充最少的自定义 CSS，不复制框架规则，不先重写再覆盖。

这里的“优先”指开发时优先复用，不是让 Bootstrap 用高 specificity 压过自定义。实际加载仍为框架 CSS → 网站 CSS；网站 CSS 内按全局设计 → 组件公用样式 → 实例参数组织。自定义只负责必要差异，避免堆叠选择器和 `!important`。

HTML 同样遵循精简原则：每层节点必须有布局、语义或交互用途；能在已有元素上加 class 就不增加包装层，不机械堆叠 `container > row > col > wrapper`。在效果、响应式、交互和必要无障碍结构完整的前提下，尽量减少 DOM 节点与嵌套。

- 结构优先使用 `.container`、`.container-full`、`.row`、`.col-*`、`.g-*`，按 Bootstrap 5 断点开发。
- 标题按内容层级用 H1–H6，不为字号大小滥用 H1。可用全局 `.text-heading` / `.text-subheading` / `.text-content-heading`，从全局配置读取字号、字重、字体和颜色。
- 按钮使用 `.btn`、`.btn-primary`、`.btn-outline-primary`；导航行为用 `<a>`，动作使用 `<button type="button">`。
- 框架链接默认及悬停均无下划线，通过 Bootstrap Sass 变量统一配置；组件无需重复声明。确需下划线时，仅在对应作用域覆盖，保留键盘焦点提示。
- 框架统一设置 `li { list-style: none; }`，默认不显示列表标记；`dl, ol, ol ol, ol ul, ul, ul ol, ul ul` 统一设置 `margin-bottom: 0; padding-left: 0;`。需要圆点、编号或缩进的内容列表在对应作用域显式恢复。
- 文字使用全局颜色、字体和字号，例如 `var(--colorBody)`、`var(--typeBody)`、`calc(var(--fontSizeBody) * 1px)`。移动端读取对应 `*Mob` 变量。
- 组件只负责自己的布局、图片裁切、特殊间距和装饰。不能覆盖全局 `h2`、`p`、`.btn` 等规则，所有组件规则必须限定 salt 根作用域。
- 样式可覆盖参数使用局部 CSS 变量，并回退到全局变量：`color: var(--component-heading-color, var(--colorHeading))`。实例值放进 `.section-{id}`，不改变网站全局配置。
- 不强制给组件所有后代设置颜色，例如 `.section-id * { color: ... }` 会破坏按钮、链接和表单状态；应通过变量和明确的目标样式覆盖。
- CSS 动态参数要按字段类型校验，不能将任意字符串直接拼接进正式 CSS。HTML 内容默认转义。
- 必须验证手机宽度、焦点可见性、长文本、同组件多实例。动画尊重 `prefers-reduced-motion`。

### 5. 原生 JS 与生命周期

```js
class Example extends fo.Section {
  constructor(element, runtime) {
    super(element, runtime);
    // 查询与事件限定当前实例：this.one / this.all / this.on / this.delegate。
  }
  destroy() { super.destroy(); }
}
fo.register('aENvYz', Example);
```

由 `data-section` 找到已注册的实现并挂载，每个根元素获得独立实例。不得依靠全局选择器给所有同类组件重复绑定事件。定时器、观察器、事件在卸载时清理；编辑器局部替换 DOM 时先 unmount 再 mount。不依赖 jQuery，不给每个组件注入 Bootstrap JS。

### 6. 后续 Java 模板转换

静态效果确认后再将固定文案/链接/图片替换为 `section.settings/data`，根节点使用 `section.id`、`section.templateId` 等。动态外观放入 `variable.th.css`；正式发布聚合到网站 CSS，不在每个 section 尾部留下空 `<style>` 或重复样式块。编辑预览可临时用 style 元素或 `style.setProperty` 进行即时预览。

开发文件：`index.html`、`section.scss` / 编译后的 `section.css`、`section.js`；配置和服务端渲染阶段另有 `manifest.json`、`section.th.html`、`variable.th.css`、`fixtures/`。索引构建器必须保留带 `theme:standalone-demo` 标记的静态页面。

### 7. 全局变量与命名空间验收

全局样式值源自 `fox.theme_schema`，提取到 `../css/page/global-variables.scss`。数值型尺寸保留数字，消费时通过 `calc(var(--fontSizeBody) * 1px)` 转为长度；带单位的 `borderRadius` 直接使用。前端可在当前文档根元素调用 `style.setProperty` 实时预览；iframe 内应修改 iframe 文档，变量不会跨文档继承。

页面像积木一样由多个不同组件组成。随机 salt 配合数据库查重是防止组件公用 CSS 命名冲突的基础，不代表随机生成天然保证唯一；并发入库仍需唯一约束兜底。生成工具：`node tools/generate-salt.mjs`，实时检查 `mall.theme_section.salt`，数据库不可用时失败。

验收需确认：不同 salt 的规则不会互相污染；同一 salt 的两个实例各自的参数和 JS 事件互不干扰；公用框架类不被组件裸选择器覆盖。动画名等全局 CSS 标识也应加 salt 前缀。

参考实现：[静态组件 DEMO](../section/imageText/KjbTA8/index.html)；[全局变量说明](../GLOBAL_VARIABLES.md)；[精简 Bootstrap 5 框架](../css/README.md)。

---

### 特殊组件：页脚的系统导航参数（当前 V2 约定）

`footer/MV3iA3` 的 `footMenu`、`footMenu2`、`footMenu3` 是三组**店铺导航槽位**，正式数据源为新库 `mall.shop_navigation`（店铺导航菜单管理）。`fox.site_navigation` 仅为旧库来源，不再作为新版运行时查询目标。它们不是组件内手工维护的 repeater，也不是三条导航记录的 ID。

| 区域选择值 / bottomMenu | 新版渲染数据 | 原模板误用位置 |
| --- | --- | --- |
| `footMenu` | `section.data.footMenu` | `section.settings.page` |
| `footMenu2` | `section.data.footMenu2` | `section.settings.footerNav1` |
| `footMenu3` | `section.data.footMenu3` | `section.settings.footerNav2` |

`settings.column[].areaContent` 和 `settings.bottomMenu` 仅选择显示哪组导航；`bindings` 用 `sourceType: "shopNavigation"` 和 `menuKey` 声明槽位；服务端在当前店铺上下文解析后注入 `data`。例如：

```json
{
  "bindings": {"footMenu": {"sourceType": "shopNavigation", "menuKey": "footMenu", "ids": []}},
  "data": {"footMenu": [{"id": "导航ID字符串", "title": "About us", "link": "/page/about-us", "target": "_self"}]}
}
```

服务端必须按当前 `shop_id` 隔离，结合系统既有的 `navigation_type`、`theme_id`、`region_code` 和 `state` 规则选组及筛选有效菜单，使用 `sort_index` 排序，`parent_id` / `level` 组织层级。`id` 保留字符串，`title` 和 `target` 保留语义，`link_url` 解析为模板数据中的 `link`；`image_url` 如需使用由数据适配层映射。当前模板显示菜单顶层链接，不擅自把子级全部平铺；`ref_type/ref_id` 的链接解析复用店铺导航逻辑，并校验链接协议和 target。未配置时注入空数组。

当前已确认新库表结构，但未确认 `footMenu*` 到 `navigation_type` 及 `state` 的业务枚举数字，不猜测映射。local 预览使用明确的示例菜单，其他 fixtures 保留原菜单内容（若无则空数组）；这不代表已完成正式服务的数据库导航查询。静态 DEMO 同样不实时查询数据库。



## 独立项目的初始化与发布

组件 `section.js` 只注册组件，不包含 `fo.init()`。静态 DEMO 在组件脚本之后加载 `js/demo.js`；该文件不入库、不进入正式合并包。发布工具再次检查并拒绝残留页面初始化代码。正式页面在所有组件注册完成后统一初始化一次。

新项目根目录是原 V2 工作区根目录。Java 预览后台仍属于独立的 theme-service 项目，不在此仓库；需要另行适配根目录路径后接入，迁移本身不会切换现有服务或 Nginx。
