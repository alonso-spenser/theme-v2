# 本地组件预览图片

图片使用配对文件：`name.ext` 为 100×100 内等比缩略图，`name.og.ext` 为 2000×2000 内等比正式图。
静态 HTML 中懒加载图片使用小图 src 和正式图 data-original/data-lazy，直接展示和背景使用 .og 图片。
SVG 保持原样。素材来自原项目的 preview-assets/images。

数据库默认图片独立打包在 mall 服务的 `/theme-images/`，不依赖本地预览服务器。
