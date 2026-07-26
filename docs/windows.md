# Windows notes

第一阶段不硬编码 WorkBuddy 安装路径。建议通过 WorkBuddy 快捷方式、`WORKBUDDY_REMOTE_DEBUGGING_PORT` 和进程启动参数配置 CDP；后续可在 daemon 中增加注册表和常见安装目录探测器。

如果 WorkBuddy 已经运行但没有 CDP 端口，请先保存任务并使用带 `--remote-debugging-port=9223` 的快捷方式启动。`wb-theme doctor --json` 会显示端口、target 数量和回环校验结果。
