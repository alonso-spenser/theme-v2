# 源码提交与构建规范

本仓库只提交源码及开发所需文件。编译文件保留在本地或由发布流水线生成，不加入 Git；适用于框架和所有 section 组件。

## 提交与排除

| 范围 | 提交 | 不提交 |
| --- | --- | --- |
| CSS 框架与全局样式 | `css/**/*.scss`、构建工具、上游许可证 | 编译后的 `.css`、`.min.css`、`.map` |
| JS 框架 | `js/src/`、`js/build.mjs`、手写 `js/demo.js` | `js/base.js`、`js/base.min.js` 及 source map |
| section 组件 | `section.scss`、`_demo.scss`、手写 `section.js`、`section.th.html`、`variable.th.css`、`manifest.json`、`fixtures/`、静态 `index.html` | `section.css`、压缩版本及 source map |
| 项目配套 | 工具、协议、测试源码、标准文档、必要的预览素材、`package.json`、`package-lock.json` | `node_modules/`、`dist/`、本地校验报告、日志、IDE 配置、凭证 |

判断依据是文件是否为源码，而不是仅看扩展名：

- `variable.th.css` 是动态 CSS 的 Java 模板源文件，必须提交。
- `js/sections.css` 是原生组件运行时的手写公共样式，必须提交。
- `section.js` 是组件注册源码，不是构建 bundle，必须提交。
- 静态 `index.html` 是开发 DEMO，保留在仓库中，方便后续编辑与对照。
- 第三方源码及许可证保留；不要提交第三方目录的安装依赖或编译产物。

## 首次使用

```sh
npm ci
npm run build
npm test
npm run serve
```

由于编译产物不在 Git 中，首次打开 DEMO 前必须构建。静态入口为 `http://127.0.0.1:9030/section/`。

## 单项构建

```sh
npm run css:build
npm run js:build
npm run sections:build
npm run index:build
```

`js:build` 同时生成普通版与压缩版。修改样式源文件后重新编译，不直接编辑生成的 CSS。`npm run component:build -- --component section/floatMenu/Ur6Jvm` 生成单组件发布包到被忽略的 `dist/`。

## 初始化与发布

## 单组件样式编译

```sh
npm run section:floatMenu:Ur6Jvm
# 通用命令（新组件无需注册即可使用）
npm run section:build -- floatMenu/Ur6Jvm
# 新增或删除组件后同步快捷命令
npm run section:scripts
```

读取对应目录的 `section.scss`，在同目录生成包含 demo 的 `section.css` 和排除 demo 的 `section.min.css`，不修改模板或 JS。入库只使用 `section.min.css`；详见 [组件文件与数据库同步](section.md)。首页每个组件标题右侧可点击复制命令；在 theme-v2 项目目录执行。产物不加入 Git。

### CDN 缓存版本标识

`npm run js:build` 与 `npm run css:build` 在产物首行的 `/*! ... */` 注释中写入 `version: 3ba1a6` 形式的 6 位内容标识。压缩版另外输出 `js/base.min.{hash}.js`（以及同名 `.js.map`）、`css/base.min.{hash}.css` 和 `css/page/base.min.{hash}.css`，文件名 hash 与头部 version 一致。保留不带 hash 的普通版及压缩版，供本地预览、现有引用和测试使用；CDN 发布推荐使用带 hash 的文件。watch 重建同样更新标识，历史 hash 文件不自动删除，部署时选择本次构建日志中的文件。

标识取首行注释之后内容的 SHA-256 前 6 位；JS 还排除末尾 sourceMappingURL 行，避免文件名参与自身哈希。它不是 Git commit 或时间戳。相同内容重复构建得到相同标识，普通版、压缩版及不同文件分别计算。查看 AWS/CDN 对应文件的第一行，与本地同名产物对比，即可辅助确认缓存版本。短标识仅用于排查，不作为安全完整性校验。

构建不会自动清除 CDN 缓存或改写页面引用；发布带 hash 的文件后，需将页面资源 URL 更新为新文件名。不要手动修改编译文件的标识。

组件 JS 只定义并注册组件，不调用 `fo.init()`。静态 DEMO 单独加载 `js/demo.js`；正式站点在所有组件注册完成后统一初始化一次。DEMO 初始化不能写入数据库或正式合并脚本。

构建产物由发布流程生成和部署到站点/CDN，而不是作为源码提交。

## 提交前检查

```sh
git status --short
git diff --cached --name-only
```

确认暂存区没有编译产物、依赖目录或凭证。`.gitignore` 不会自动取消已被 Git 跟踪的文件；若误跟踪了产物，使用精确路径的 `git rm --cached <文件>` 仅取消跟踪，保留本地文件。

`css:build` 批量生成框架及所有组件的 CSS。普通 `.css` 保留演示样式，`.min.css` 在编译前排除 demo；带 hash 的框架压缩文件也使用正式内容。`css:watch` 同时监听组件 SCSS。此命令不写入数据库。
