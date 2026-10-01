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

组件 JS 只定义并注册组件，不调用 `fo.init()`。静态 DEMO 单独加载 `js/demo.js`；正式站点在所有组件注册完成后统一初始化一次。DEMO 初始化不能写入数据库或正式合并脚本。

构建产物由发布流程生成和部署到站点/CDN，而不是作为源码提交。

## 提交前检查

```sh
git status --short
git diff --cached --name-only
```

确认暂存区没有编译产物、依赖目录或凭证。`.gitignore` 不会自动取消已被 Git 跟踪的文件；若误跟踪了产物，使用精确路径的 `git rm --cached <文件>` 仅取消跟踪，保留本地文件。
