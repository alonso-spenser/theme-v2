# 本地组件预览图片

`images/` 中的图片复制自用户提供的 `/Users/joe/Desktop/img/`，保留原文件，未复制视频。
为产品、图文、轮播、Logo、头像等场景提供本地预览素材。

通过 `/preview-assets/images/<文件名>` 访问，由 theme-service 服务。
兼容旧模板附加的 `!1`、`!f3` 等图片缩放后缀，本地直接返回原图。

替换仅写入各组件的 `fixtures/local.json`，原 `default.json`、`sample.json` 和 `source.json` 保持不变。
本地图优先按原文件名匹配，否则按字段与组件用途选择；空图片字段仍保持为空。
`replacements.json` 记录替换数量。

```sh
node tools/local-preview-images.mjs
node tools/verify-restored-sections.mjs
```
