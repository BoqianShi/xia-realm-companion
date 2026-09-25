# 资料包

`content/demo.json` 是可直接复制修改的完整原创示例。类型在 `lib/types.ts`、`lib/module-types.ts`、`lib/adventure-encounters.ts` 和 `lib/content-pack.ts`；结构检查在 `scripts/validate-content.mjs`。

## 导入

把 JSON 及资源放进被忽略的 `private-content/`，或仓库外。每次启动/构建都指定同一个变量；没有变量时加载原创演示。

```sh
XIA_CONTENT_PACK=./private-content/my-pack.json npm run dev
XIA_CONTENT_PACK=./private-content/my-pack.json npm run build
XIA_CONTENT_PACK=./private-content/my-pack.json npm run deploy
```

Windows PowerShell 先执行 `$env:XIA_CONTENT_PACK = './private-content/my-pack.json'`，再执行 npm 命令。

这是构建时的结构化 JSON 导入，不会自动识别 PDF、图片或任意规则原文。正文使用文字和可选段落结构，公式必须显式填写；不由 AI 临时计算。新增规则效果需要对应代码与测试。

## 字段

| 字段 | 用途 |
| --- | --- |
| `schemaVersion` | 当前 `1` |
| `id`, `title` | 稳定标识、名称 |
| `rulesVersion` | 存档规则版本，不兼容变化需更新 |
| `revision` | 资料校对修订号，与规则版本分开 |
| `sources` | `core` / `expansion` 两类别的展示名称 |
| `catalog` | 内功、套路、单招、装备、背景等 |
| `starter` | 入门构筑与说明 |
| `modules` | 正文、NPC、章节、资源索引 |
| `encounters` | 关联模组与 NPC 的遭遇阵容 |
| `encounterPeople` | 可选的独立遭遇人物索引；含按剧情补录的人物，不覆盖模组原卡 |
| `encounterVersion` | 可选遭遇修订号；未提供时使用 `revision` |
| `assets` | 可选本地文件清单 |

条目 `source` 保留类别、版本和页码。套路组织招式，单招 `parentId` 指向套路；每招独立品级、阶段、费用。`formula` 使用英文枚举，例如 `physical`、`main`、`simple`（简要动作）；未知效果通过 `unresolvedEffects` 等字段保留，不填 0 假装完成。详细字段以类型定义为准。

`starter.build` 覆盖基础构筑字段，角色名和规则版本由程序设置。`learn` 是 `{ "id": "…", "level": 2 }`；`equipment`、`activeWeapon`、`favorites` 使用条目 ID。收藏套路即可显示已学招式。导入验证不代替规则校对和自定义包的回归测试。

迁移已有完整入门构筑时，可将其放进 `starter.build`，让 `learn`、`equipment` 留空，保留逐招的学习来源。`starter.backgroundGrant` 可保存建卡草稿中身世实际赠送的项目，避免切换背景时误删后来添加的装备。

`encounterPeople` 按模组 ID 保存 NPC 数组。提供该字段时，每组遭遇的 `npcId` 必须在对应索引中；不提供时从 `modules[].npcs` 查找。NPC ID 可保留中文及全角分隔符，文件路径仍只用安全的英文标识。不要为了导入而重新生成已有 NPC 的 ID。

## 附件

纯文字模组无需 PDF 或图片。有附件时，顶层显式声明：

```json
{
  "assets": [
    { "file": "images/courtyard.webp", "path": "my-module/courtyard.webp" }
  ]
}
```

`file` 相对于包 JSON，不能越过该目录（包括符号链接）。`path` 相对于生成的 `public/modules/`，仅字母、数字、斜杠、下划线和短横线。允许 png/jpg/jpeg/webp/pdf/txt/doc/docx/xls/xlsx，不允许脚本、HTML、SVG、远程地址或任意目录拷贝。旧版 Office 文件仅作为原附件保留，不由服务端打开或执行。

模组 `cover`、`pdf`、页面 `image`、NPC `url`、附件 `url`/`preview` 只能引用已声明的 `/modules/...` 或留空；允许 `#page=22` 形式的页码定位，仍校验底层文件已声明。`contentUrl` 自动生成为 `/modules/<id>/content.json`。页面从 1 连续编号，章节和遭遇页码应存在。

`.local-content/pack.json` 与 `public/modules/` 均不提交 Git。**它们会进入浏览器和部署产物，不是服务器私密存储。**

## 升级

同一条目保持 ID，不用名称代替。更换包前导出本团，尽量使用独立数据库验证。导入不删除 D1 旧角色，也不把旧 ID 自动转换成新包 ID。无唯一映射时保留历史记录、提示核对，不赠送额外招式。

公开提交只允许 `content/demo.json`。`npm run check:public` 检查 Git 索引，阻止生成内容和常见敏感文件进入提交；它不能判断著作权，贡献者仍需审核新增材料。
