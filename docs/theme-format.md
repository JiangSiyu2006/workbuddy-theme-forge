# `.wbtheme` format

主题包是 ZIP 容器，根目录至少包含：

```text
theme.json
theme.css
assets/       # 可选，仅图片/字体引用
preview.png   # 可选
LICENSE
```

`theme.json` 的 `schemaVersion` 当前为 `1`，`id` 必须是小写字母、数字和连字符；`colors`、`variables`、`selectors`、`assets`、`reducedMotion` 由 schema 校验。资源引用只能是包内相对路径，导入器拒绝 `..`、绝对路径和超过 32 MiB 的包。

官方 renderer 的真实 DOM 可能随版本变化，主题应尽量使用 `selectors` 和 adapter 诊断，而不是硬编码单一页面结构。
