# 本地 V2 预览站

工作区：`/Users/joe/Documents/github/theme-v2`；Java 后台：相邻 `theme-service` 项目，端口 9025。

Nginx 配置在 `deploy/theme.conf`。安装需要管理员权限：

```sh
sudo /bin/sh /Users/joe/Documents/github/theme-v2/deploy/install-nginx.sh
```

脚本先备份现有配置，安装后执行 `nginx -t`，成功才重载；失败恢复原配置。

安装后访问：

- `http://www.theme.com/`：组件目录首页，保留原目录 UI，包含静态 DEMO 与 Java 参数预览入口。
- `/section/` 目录入口跳转到首页；`/section/{type}/{salt}/index.html` 继续用于组件 DEMO。
- 旧 `/v2/` 路径已停用，返回 404，不提供旧主题兼容路由。
- `http://www.theme.com/preview?component=imageText/KjbTA8&fixture=local`：Java 参数预览。

Nginx 静态根目录必须为 theme-v2，不再读取旧 theme。框架构建仍使用 `npm run build`。参数预览由 Java 按需编译 SCSS，文件变化会触发预览刷新。

Java 的 `--runtime-root` / `THEME_RUNTIME_ROOT` 现在指向 theme-v2 项目根目录；launch agent 的 PATH 使用 theme-v2/node_modules/.bin。页面 CSS、JS 和图片均从该根目录读取。独立 `npm run serve` 的 9030 端口仍仅支持静态 DEMO，不支持 `/preview` 参数预览。

`/css/` 优先使用本项目静态文件，缺失资源仍交给 Java 固定上游 CSS 代理；不对外开放后台管理端口。
