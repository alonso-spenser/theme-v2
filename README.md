# Theme V2

源码提交与编译产物规则见 [源码与构建规范](docs/SOURCE_AND_BUILD.md)。

独立的 V2 主题组件项目，不依赖旧 theme 仓库。当前迁入 159 个已有实现组件，未迁入 13 个商城占位组件。迁入不代表逐个完成视觉与业务交互验收。

## 目录

- `js/`：原生框架源码、普通/压缩构建；`demo.js` 仅用于静态 DEMO。
- `css/`：精简 Bootstrap 5、页面全局 CSS 变量及其消费样式。
- `section/{type}/{salt}/`：组件、Java 模板、配置、演示数据与静态 HTML。
- `preview-assets/`：本地演示素材，版权说明见该目录 README。
- `tools/`、`schema/`、`contracts/`、`shared/`：V2 构建、校验及协议。
- `docs/THEME_COMPONENT_DEVELOPMENT_GUIDE.md`：当前生效的组件标准。

## 开发

```sh
npm ci
npm run build
npm test
npm run serve
```

静态目录入口： http://127.0.0.1:9030/section/ 。`PORT=9031 npm run serve` 可更换端口，默认仅监听本机。

单独构建：`npm run css:build`、`npm run js:build`（同时生成 base.js/base.min.js）、`npm run sections:build`。
单组件发布：`npm run component:build -- --component section/floatMenu/Ur6Jvm`，输出 `dist/`，不连接或写入数据库。

组件脚本只注册组件，正式页面统一初始化一次。静态 DEMO 额外加载 `js/demo.js`，发布包中不包含它。

salt 生成：`node tools/generate-salt.mjs`。显式配置 `THEME_DB_USER`、`THEME_DB_PASSWORD`，可选 `THEME_DB_HOST`、`THEME_DB_PORT`、`THEME_MYSQL_BIN`；只读检查 mall.theme_section，连接失败不会生成未验证 salt。不要把凭证写进仓库。

Java 参数预览由独立的 theme-service 提供，已适配新工作区。Nginx 安装与访问说明见 [本地预览站](docs/PREVIEW.md)。这里的 `serve` 只提供静态 DEMO，不执行 Java 模板。
