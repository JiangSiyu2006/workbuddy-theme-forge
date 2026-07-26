# Architecture

```text
CLI / local editor
        |
theme-store <-> theme-schema <-> themeToCss
        |
cdp-client -> injector -> WorkBuddy renderer
        |
daemon + state/snapshot + diagnostics + adapters
```

`cdp-client` 负责回环地址校验、target 过滤、超时和 WebSocket 命令匹配；`injector` 只维护一个固定 style id，保证重复注入幂等；`theme-store` 负责主题目录、`.wbtheme` ZIP 容器和路径安全；`adapters` 保存不同 WorkBuddy 版本的 selector/变量契约；`daemon` 只做重注入，不干预 WorkBuddy 生命周期。

MVP 使用本地 Web 编辑器，未来可以把同一 API 封装进 Electron tray shell。
