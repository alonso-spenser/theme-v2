# Section 文件规范与数据库同步

本文适用于独立的 `theme-v2` 项目，仅使用 V2 的 `editor.groups` 配置。`theme-v2` 负责开发、演示、校验和生成发布内容；装修和正式站点由 `oga-mall-service` 读取 `mall.theme_section` 渲染，不在运行时读取本项目目录。

## 创建空组件

```sh
npm run section:create -- imageText '图文组件' 'Image with text'
# npm 也接受不带 -- 的形式：
npm run section:create imageText '图文组件' 'Image with text'
```

命令创建 `section/{type}/{salt}/` 下的完整空骨架：V2 manifest、空参数组、HTML 模板、动态 CSS 模板、组件 JS、静态演示页、默认 fixture、SCSS 与 demo SCSS，并编译两份 CSS。类型必须以字母开头且仅含字母数字；中英文名称均必填，含空格时用引号包住。已有类型可继续添加新的不同模板。

salt 由 JavaScript 生成，为 6 位小写字母与数字混合，首位固定为字母，至少包含一个数字。生成前后使用本地 catalog、实际目录及 manifest 标识，并只读查询数据库 `mall.theme_section.salt` 和 `section_schema.templateId`，忽略大小写排除重复。数据库查重优先使用环境变量 `THEME_DB_USER`、`THEME_DB_PASSWORD`。未提供完整凭证时，可用 `THEME_DB_CONFIG` 指定含 `spring.datasource` 的 YAML 文件；未指定时自动合并同级 `mall/oga-mall-service/src/main/resources/application-dev.yml` 和 `~/.config/oga-mall-service/datasource.local.yml`（后者覆盖前者）。可选 `THEME_DB_HOST`、`THEME_DB_PORT`、`THEME_MYSQL_BIN` 覆盖连接参数。自动查找 macOS MySQL 官方安装及 Homebrew 客户端，最后使用 PATH 中的 mysql。连接失败不会跳过查重创建组件，也不要把凭证写入仓库。

创建成功自动更新 `section/catalog.json`、首页 `index.html` 导航、`section/index.html` 入口及 `package.json` 中的 `section:{type}:{salt}` 编译快捷命令。静态演示页只有空框，正式内容和参数列表为空，可直接开始开发。创建会自动构建并校验完整发布包，使用本机数据库配置向 `mall.theme_section` 插入新组件；只有数据库确认插入一条记录才报告成功。不会覆盖已有记录。

本地创建使用 `.section-create.lock` 防止两个创建命令同时覆盖目录索引，构建等前置步骤失败会还原目录索引、package 和本次新组件；数据库执行失败或结果不确定时保留文件及生成 SQL，先核对记录再决定重试，避免重复创建。跨机器发布仍需服务端唯一性校验，不能把本地随机生成视为数据库事务预留。

### 参数与初始状态

| 参数 | 示例 | 规则 |
| --- | --- | --- |
| `type` | `imageText` | 字母开头，仅字母和数字，最长 50 位；允许在已有类型下新增不同模板 |
| 中文名称 | `'图文组件'` | 写入 `manifest.name['zh-CN']`，必填，最长 200 字符 |
| 英文名称 | `'Image with text'` | 写入 `manifest.name.en`，必填，最长 200 字符 |

新组件默认 `componentKind: section`、`runtimeVersion: 2`，定义和 Schema 版本均为 1；允许删除、复制，不限制实例数量。`editor.groups`、默认 settings、bindings 和 data 均为空。仅生成 `fixtures/default.json`，`sample.json`、`local.json` 按后续开发需要添加。

创建后的演示页使用 `_demo.scss` 显示一个最小高度的虚线空框，便于找到组件位置；这个空框样式不会进入正式 `section.min.css`。尚未添加正式样式时，压缩 CSS 为空是正常情况。

### 创建后的开发步骤

1. 从命令输出取得 `type/salt`，打开首页导航中新增的组件，或访问 `/section/{type}/{salt}/index.html`。
2. 在 `manifest.json` 的 `editor.groups` 添加参数，并同步维护 fixture 中对应的 settings。
3. 编辑 `section.th.html`、`section.scss`、`variable.th.css` 和 `section.js`；静态 `index.html` 是独立演示文件，修改模板不会自动把它渲染成新的静态 HTML。
4. 执行单组件编译或 `npm run css:build`，核对演示与正式 CSS 的区别。
5. 构建发布包并按本文入库流程提交。`section:create` 已完成首次完整入库；后续按字段更新已有记录。CSS-only SQL 只更新已存在的数据库记录。

例如命令返回 `imageText/a1b2c3`（仅示意，以实际输出为准）：

```sh
npm run section:build -- imageText/a1b2c3
npm run component:build -- --component section/imageText/a1b2c3
npm run serve
```

首次使用需先执行 `npm ci` 和 `npm run build`，确保演示引用的框架 CSS/JS 已生成。已有开发环境无需因创建组件重复安装依赖。

### 创建失败时

- 参数不合法：修正类型或名称后重试，不会生成组件。
- 数据库查重失败：检查 MySQL 客户端、本机商城配置（或显式环境变量）和查询权限；不能通过忽略错误来创建未经查重的 salt。
- 提示已有创建任务：等待另一个命令结束；若上次进程被强制终止，确认已无创建任务后再检查和清理残留锁目录。
- 编译或导航更新失败：前置构建失败会回滚本次组件和索引修改；数据库执行结果不确定时保留文件，必须先核对数据库记录。

## 1. 组件目录

```text
section/{type}/{templateId}/
├── manifest.json        # V2 组件定义
├── section.th.html      # 正式 HTML 的 Thymeleaf 模板
├── section.scss         # 公共样式源码
├── _demo.scss           # 仅供演示的实例样式
├── section.css          # 编译产物：演示版，包含 demo
├── section.min.css      # 编译产物：正式版，不包含 demo
├── variable.th.css      # 正式实例属性的动态 CSS 模板
├── section.js           # 组件注册和交互源码
├── index.html           # 静态演示页
└── fixtures/
    ├── default.json     # 默认演示/校验数据
    ├── sample.json      # 示例数据
    └── local.json       # 本地预览数据（实际文件按组件需要配置）
```

`type` 表示组件类型，例如 `floatMenu`；`templateId` 是组件模板标识，例如 `Ur6Jvm`。两者必须与 manifest 一致。组件定义、组件实例、数据库记录 ID 是不同概念，同一组件定义可以被多个店铺实例引用。

模板标识不能依赖数据库 `salt` 的当前值：管理后台保存时会更新 `salt` 作为并发修改版本；V2 模板标识应读取 `section_schema.templateId`。数据库 ID 全程作为字符串处理。

## 2. 各文件职责

| 文件 | 规范 | 是否入库 |
| --- | --- | --- |
| `manifest.json` | 描述 type、templateId、版本、双语 name、policy、render、editor.groups、数据契约等；公共分组 `$include` 在发布时展开 | 展开后的定义存 `section_schema` |
| `section.th.html` | 只包含组件 HTML，不包含完整页面 head/body 或页面统一初始化；根节点及公共类使用模板命名空间 | `thymeleaf_template` |
| `section.scss` | 公共结构、布局及交互状态样式；可以保留末尾 `@import "demo";` 供本地演示 | 不直接入库 |
| `_demo.scss` | 静态 DEMO 的颜色、间距等实例值，通常使用 `.section-demo-...` | 不入库 |
| `section.css` | 可读演示产物，包含 `_demo.scss`，由 `index.html` 引用 | **禁止入库** |
| `section.min.css` | 压缩正式产物，在编译前排除 `@import "demo";` | **`base_css` 的唯一文件来源** |
| `variable.th.css` | 根据正式实例 settings 等渲染 CSS，以 `.section-实例ID` 限定作用域 | `variable_css` |
| `section.js` | 注册组件、实现组件交互，不调用页面级 `fo.init()`；发布时再次检查演示初始化残留 | 发布包净化后的 script 存 `script_code` |
| `index.html` | 开发预览页，加载演示资源以及 `js/demo.js`；不是正式服务的 HTML 模板 | 不入库 |
| `fixtures/*.json` | 模拟预览数据，用于开发与校验；不能作为真实店铺内容提交 | 不直接入库 |

`manifest.editor.groups` 中字段的 `default` 生成发布包 `defaults`。`defaults` 用于新增实例的初始参数，不应使用 fixtures 替代，也不能覆盖商家已有实例配置。名称中文使用 `name['zh-CN']`，其他后台语言使用 `name.en`。

公共 CSS 使用组件命名空间，实例自定义 CSS 使用实例命名空间。不要把某个 DEMO 的固定颜色或间距写入公共样式，也不要在每个组件里重复打包全站基础 CSS。

## 3. 编译命令与两种 CSS

在 `theme-v2` 根目录执行：

```sh
# 单个组件：同时生成 section.css 与 section.min.css
npm run section:build -- floatMenu/Ur6Jvm

# 已登记组件的快捷命令，等价于上一条
npm run section:floatMenu:Ur6Jvm

# 批量生成框架及所有组件的 CSS（普通版含 demo，压缩版不含 demo）
npm run css:build

# 全量演示检查及组件 CSS 构建
npm run sections:build

# 新增组件后更新快捷命令（不会同步数据库）
npm run section:scripts
```

三个编译入口（单组件、全量组件、发布包）共用 `tools/component-style.mjs`：

1. 正式编译前移除独立行的 `@import "demo";`，保留其他公共 Sass 依赖。
2. 正式 CSS 使用压缩输出，关闭 Sass charset/BOM 输出。
3. 演示 CSS 从原始 SCSS 正常编译，保留 demo。
4. 若间接依赖仍导入 `_demo.scss`，正式编译失败，不允许污染发布包。

`section.min.css` 不是把包含 demo 的 `section.css` 简单压缩得到的。不能绕过上述脚本直接用同一份 SCSS 分别指定 expanded/compressed 后入库。

## 4. 完整组件发布包

```sh
npm run component:build -- --component section/floatMenu/Ur6Jvm
```

工具先校验 manifest、参数字段、数据契约、模板引用、fixtures 和 JS，再生成：

```text
dist/floatMenu/Ur6Jvm/{definitionVersion}/
├── manifest.expanded.json
├── defaults.json
├── section.java          # 构建器对 section.th.html 的输出命名，并非 Java 类
├── section.css           # 演示产物，不用于入库
├── section.min.css       # 正式 CSS
├── variable.java         # variable.th.css 的输出命名（有配置时生成）
├── section.js
└── publish.json
```

| 发布包内容 | 保存 API 的 values 字段 | 数据库字段 |
| --- | --- | --- |
| `definition` | `sectionSchema` | `section_schema` |
| `defaults` | `sectionData` | `section_data` |
| `assets.thymeleafTemplate` | `thymeleafTemplate` | `thymeleaf_template` |
| `assets.baseCss`，对应 `section.min.css` | `baseCss` | `base_css` |
| `assets.variableCss` | `variableCss` | `variable_css` |
| `assets.script` | `scriptCode` | `script_code` |

`publish.json` 校验和覆盖正式 CSS，不使用演示 CSS。**构建命令只生成文件，不连接或修改数据库。**

完整定义新增/修改通过商城已有接口 `POST /api/main/theme/section/save` 提交 `{id, version, values}`。更新前读取 detail，`version` 使用响应的 `salt`，避免旧编辑器覆盖新数据；服务端验证后事务保存并返回新版本。`sectionSchema` 和 `sectionData` 必须一起提交。新组件还需要名称、唯一编码、类型等基础字段，分组及适用范围需按业务配置，不从目录名称猜测。

完整发布时只映射需要更新的字段，保留数据库 ID、标签、归属、翻译和其他未编辑字段。发布定义不改写 `shop_theme_page_section` 中已经保存的店铺实例参数。

`section:create` 自动完成新组件的完整入库。`section:sql` 与 `section:css:sql` 默认同步数据库，添加 `--dry-run` 才只生成 SQL；`component:build`、`section:scripts` 不写数据库。

## 5. 仅同步公共 CSS 的数据库命令

公共 CSS 同步入口（默认实际执行入库）：

```sh
npm run section:css:sql -- floatMenu/Ur6Jvm
```

执行逻辑：

1. 校验 `type/templateId` 路径及 V2 manifest 身份。
2. 重新编译演示、正式两份 CSS。
3. **只读取 `section.min.css` 内容**；与当前源码重新计算的正式 CSS 比较，过期或含 demo 的文件会被拒绝。
4. 生成 `dist/database/floatMenu/Ur6Jvm/base-css.sql`。
5. 使用本机数据库配置连接数据库，将更新前的 ID、版本及六项定义字段备份到 `before-时间戳.json`，执行 SQL；确认影响 1 行后输出 `Database synchronized`。添加 `--dry-run` 时不连接、不备份、不执行，只生成 SQL。

SQL 按唯一编码 `floatMenu.Ur6Jvm` 且 `section_schema.runtimeVersion = 2` 定位已有记录，只更新 `base_css` 并刷新并发版本 `salt`。不新增记录，不覆盖 HTML、JS、variable_css、Schema、默认值或商家数据。使用 UTF-8 十六进制值写入，避免 CSS 引号及反斜杠被 SQL 转义改变。

执行输出 `updated_sections` 应为 1；为 0 表示没有匹配的现有 V2 记录，应检查编码而不是扩大更新条件。SQL 为按需生成的即时发布快照，不要长期保存后再次执行以覆盖后续修改；编译期间如有人在线编辑该定义，应重新比对。更新前自动生成的字段备份可用于核对和恢复（不包含无关字段）。

若数据库中有尚未回写源码的 CSS 修改，应先核对合并再运行同步命令；同步语义是以当前正式源码编译结果替换 `base_css`。

## 6. 发布后的检查

- 对比 `publish.assets.baseCss` 与发布目录 `section.min.css`，应一致。
- `base_css` 不应出现 `.section-demo-...`，静态 `section.css` 可包含它。
- 正式站点公共 CSS 按组件定义去重并聚合；实例自定义 CSS 仍由 `variable_css` 渲染在页面中。
- 公共 CSS 内容改变后，站点资源内容哈希可能改变；用最新 HTML 中引用的地址核对，不只刷新旧哈希资源。
- 开发仓库只提交源码、工具和文档；`.css` 编译产物、dist、备份、日志和凭证不加入 Git。`variable.th.css` 是模板源码，属于例外，需要提交。

针对生产/演示分离及 SQL 输入的回归检查：

```sh
node --test tools/component-style.test.mjs tools/section-css-sql.test.mjs
```

## 7. 完整新增与按字段更新

原 `section:css:sql` 命令可继续使用，也可使用统一入口 `section:sql`。带参数时先重新构建并校验发布包，拒绝未知参数，防止拼写错误导致更新范围与预期不同。

```sh
# 兼容原命令：同步公共 CSS 到数据库
npm run section:css:sql -- floatMenu/Ur6Jvm

# 按需组合：Schema、Java 模板、默认数据
npm run section:sql -- floatMenu/Ur6Jvm --schema --java --data

# CSS 包括公共样式和实例模板时显式选择两项
npm run section:css:sql -- floatMenu/Ur6Jvm --css --variable-css

# 更新所有六项定义内容
npm run section:sql -- floatMenu/Ur6Jvm --all

# 已有本地组件但尚未入库：完整新增到数据库
npm run section:sql -- advantage/a1b2c3 --create
```

`a1b2c3` 为示例，应替换为真实目录标识。

| 参数 | 更新内容 |
| --- | --- |
| `--schema` | 展开公共分组后的 `section_schema` |
| `--java` | `thymeleaf_template` |
| `--css` | `base_css`，只使用正式 `section.min.css` |
| `--variable-css` | `variable_css`，实例自定义样式模板 |
| `--script` | `script_code`，已排除演示初始化的组件脚本 |
| `--data` | `section_data`，Schema 字段生成的默认参数 |
| `--all` | 上述六项，不修改名称、标签、归属等其他元数据 |
| `--create` | 完整新增，包括新 UUID 数据库 ID、名称、编码、类型、分组、版本及六项定义内容 |
| `--group=3000` | 仅用于 `--create`；默认普通组件 3000，可选 1000/2000/3000/4000 |

修改 Schema 并影响默认值时建议同时选择 `--schema --data`。更新默认值不覆盖店铺实例中已有的用户参数。未指定更新项默认只更新 CSS。

带更新参数生成 `dist/database/{type}/{salt}/update.sql`；新增生成 `create.sql`；原 CSS-only 命令保持 `base-css.sql`。这些命令默认生成并执行 SQL；仅查看 SQL 时添加 `--dry-run`。`--create` 检查已有唯一编码、salt 和 Schema templateId，匹配时不插入，受影响行数为 0，绝不 upsert。数据库的编码唯一约束继续兜底。

`section:create` 内部自动调用上述完整新增流程并执行 SQL；无需再手工执行 create.sql。若创建时提示入库结果未确认，应保留生成目录并核对数据库，不能直接重新创建另一个 salt。SQL 文件不可长期复用覆盖后续修改，执行已有组件更新前先备份并确认无人同时编辑。

手动删除组件目录后，`section:create` 或 `index:build` 会清理 catalog 和首页中对应的失效条目，并移除该组件由工具生成的编译快捷命令。仅目录不存在时清理；目录仍存在但 manifest 损坏或丢失时仍报错，避免掩盖不完整的组件。此操作不删除数据库记录。

### 仅生成 SQL，不修改数据库

```sh
npm run section:sql -- advantage/a9e395 --css --dry-run
```

正常同步示例：`npm run section:sql -- advantage/a9e395 --css`。以 `Database synchronized` 和受影响行数 1 作为执行成功标志。若提示结果未确认，先核对记录，不要盲目重试。
