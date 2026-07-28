# Architecture

```text
CLI / local control server / PowerShell launcher
                    |
                 runtime
          /---------+---------\
 theme-store     diagnostics   daemon
      |              |          |
 theme-schema -- adapters -- cdp-client
      |                         |
 theme-assets ----------- injector
                    |
             WorkBuddy renderer(s)
```

- `cdp-client` 仅连接 `127.0.0.1`，负责 target 发现、WebSocket 命令匹配、超时和关闭。
- `adapters` 保存版本范围、逻辑区域 selector 和变量契约；`adapter-535` 是 v0.2.0 的正式支持基线。
- `injector` 负责预检、CSS 编译、外观快照、哈希验证、恢复和回滚。
- `theme-assets` 校验图片和安全 CSS，并将主题包内图片转为 renderer 可用的 data URL。
- `theme-store` 管理内置/用户主题、标准 ZIP、冲突策略和原子写入。
- `runtime` 为 CLI 和控制台提供一致的多 renderer 操作。
- `daemon` 检查主题 ID 和 CSS 哈希，刷新或样式丢失时重新注入。

控制台与守护存在于同一 Node.js 进程。关闭控制台即停止守护，不创建系统服务、托盘或计划任务。
