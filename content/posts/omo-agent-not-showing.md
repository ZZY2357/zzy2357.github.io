+++
date = '2026-06-28T17:30:00+08:00'
title = 'Oh My OpenAgent 只显示 plan/build 两个 Agent 的修复记录'
showToc = true
tags = ['opencode', 'omo', 'oh-my-openagent', 'ai']
+++

## 问题

装了 oh-my-openagent 之后，`opencode agent list` 和执行 `npx oh-my-openagent doctor` 都显示正常，但 opencode TUI/Desktop 的 Agent 选择器里**只显示 `plan` 和 `build`**，没有 Sisyphus、Prometheus、Oracle 等 OMO Agent。

这个问题在官方仓库有多人在追踪：

- [#3456](https://github.com/code-yeongyu/oh-my-openagent/issues/3456) — "[Question]: installed OMO, reopen opencode can not find Sisyphus in agents"
- [#3835](https://github.com/code-yeongyu/oh-my-openagent/issues/3835) — "[Bug]: oh-my-openagent custom agents not showing in OpenCode Desktop UI after v1.14.x update"
- [anomalyco/opencode#30855](https://github.com/anomalyco/opencode/issues/30855) — "Plugin-registered Agents Unavailable after Update Operation on Opencode Desktop"

## 原因分析

实际导致这个症状的原因有三种，严重程度递增：

### 原因一：配置作用域不匹配

OpenCode 的配置文件有两个层级：

| 作用域 | 路径 | 优先级 |
|--------|------|--------|
| 全局 | `~/.config/opencode/opencode.json` | 低 |
| 项目本地 | `.opencode/opencode.json`（启动目录下） | **高** |

通过 `npx oh-my-openagent install` 安装时，写入的是**全局**配置。但如果启动 opencode 的工作目录下恰好存在 `.opencode/opencode.json`（哪怕只有简单几行），opencode 就会优先读这个本地配置，而本地配置可能没有注册插件。

在我自己的环境里，`C:\Users\lenovo\Documents\.opencode\opencode.json` 就这么存在了，导致插件似乎装了但 opencode 不认。

### 原因二：插件缓存损坏

另一个更隐蔽的问题是 OpenCode 的插件缓存目录 `~/.cache/opencode/packages/oh-my-openagent@latest/` 中 `node_modules` 不完整。典型表现为 `zod` 模块缺少运行时的 JS 入口文件：

```
Failed to load plugin oh-my-openagent@latest:
Cannot find module '...\node_modules\zod\index.js'
```

插件根本没加载起来，Desktop 自然就只能显示本地 Agent。

### 原因三：多作用域 + 跨版本污染（最坑）

**这是最隐蔽也是最常见的情况**，即使 `doctor` 和 `agent list` 正常也可能复现。实际场景：

1. 你一开始用 `opencode plugin oh-my-openagent@latest` 装了一次，写入了配置 A
2. 后来又用 `bunx oh-my-openagent install` 装了一次，写入了配置 B
3. 中间某个 Desktop 更新导致工作目录变了，创建了新的 `.opencode/opencode.json`
4. 结果可能是 **三个不同路径的配置文件** 都注册了 OMO 插件，且版本标签不一致（`@latest`、`@4.13.0`、裸名等）

OpenCode 在合并多层级配置时，会把所有 plugin 条目合并成一个数组。OMO 插件加载时发现**重复的 plugin 条目**，会打印：

```
[oh-my-openagent] Duplicate OMO plugin entries detected
{"duplicatePlugins":["oh-my-openagent@latest","oh-my-openagent@4.13.0"], ...}
```

然后 OMO **直接拒绝注册 Agent**——这就是为什么 `opencode agent list` 也看不到 OMO Agent 的根因。

更糟的是，不同版本的缓存目录（`oh-my-openagent@latest`、`oh-my-openagent@4.13.0`、`oh-my-openagent`）可能共存，其中一些是完整的、有些是残缺的。OpenCode 尝试加载时碰到残缺缓存，悄悄失败，用户完全看不到错误提示。

## 解决方案

### 步骤一（轻度）：修复配置作用域

从 opencode 的**启动工作目录**执行：

```powershell
opencode plugin oh-my-openagent@4.13.0
```

这条命令会把插件注册到 opencode **实际在用的**那个 `opencode.json`，并确保缓存目录安装完整。

如果不确定 opencode 读的是哪个配置，看命令输出里的 `Scope` 行：

```
•  Scope: local (C:\Users\xxx\Documents\.opencode)
```

> **注意**：不要用 `@latest`！这会让 opencode 每次启动都去检查最新版本，启动变慢。用固定版本号 `@4.13.0` 即可。

### 步骤二（中度）：重建插件缓存

如果步骤一不行，说明缓存已经损坏，需要重建：

```powershell
# 1. 关闭 opencode Desktop/TUI

# 2. 删除特定版本的缓存
Remove-Item -LiteralPath "$env:USERPROFILE\.cache\opencode\packages\oh-my-openagent@4.13.0" -Recurse -Force

# 3. 重新安装
opencode plugin oh-my-openagent@4.13.0
```

### 步骤三（核武器）：彻底清空 + 官方重装

如果前面两步都不行（像我一样），说明**多作用域配置污染 + 跨版本缓存混乱**同时存在，需要彻底清空后从零安装：

```powershell
# 0. 安装 Bun（先决条件）
irm bun.sh/install.ps1 | iex

# 1. 关闭 opencode Desktop/TUI

# 2. 删除所有 OMO 配置
Remove-Item -LiteralPath "$env:USERPROFILE\.config\opencode\oh-my-openagent.json" -Force
# 从全局 opencode.json 中手动移除 "oh-my-openagent*" plugin 条目
# 从全局 tui.json 中手动移除 "oh-my-openagent*" plugin 条目

# 3. 删除所有可能存在的本地 .opencode 配置
#    重点检查这些目录：
#    - %USERPROFILE%\Documents\.opencode\
#    - 你的项目目录\.opencode\
#    - OpenCode Desktop 安装目录\.opencode\ (如 D:\Apps\OpenCode\.opencode\)
Remove-Item -LiteralPath "C:\Users\lenovo\Documents\.opencode" -Recurse -Force
Remove-Item -LiteralPath "<项目目录>\.opencode" -Recurse -Force
Remove-Item -LiteralPath "<Desktop安装目录>\.opencode" -Recurse -Force

# 4. 删除所有 OMO 缓存
Remove-Item -LiteralPath "$env:USERPROFILE\.cache\opencode\packages\oh-my-openagent*" -Recurse -Force

# 5. 用官方 bunx 重装（这会写入全局配置，不产生本地 .opencode）
$env:BUN_INSTALL_CACHE_DIR = "D:\bun-cache"  # 可选：指定 Bun 缓存目录
bunx oh-my-openagent install --no-tui --platform=opencode `
    --claude=no --openai=no --gemini=no --copilot=no --skip-auth

# 6. 修改全局配置，把 @latest 改成 @4.13.0
#    编辑 ~/.config/opencode/opencode.json
#    编辑 ~/.config/opencode/tui.json

# 7. 配置模型（可选：编辑 ~/.config/opencode/oh-my-openagent.json）
```

### 如何确认 opencode Desktop 的启动目录？

**关键**：Start Menu 快捷方式的工作目录可能不是你项目目录。检查方法：

```powershell
# 找到开始菜单快捷方式
$link = (New-Object -ComObject WScript.Shell).CreateShortcut(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\OpenCode.lnk"
)
$link.WorkingDirectory
# 我这里是 D:\Apps\OpenCode
```

如果这个目录下有 `.opencode\opencode.json`，那就是 Desktop 实际在用的配置。

### 验证

```powershell
# 检查缓存完整性
Test-Path "$env:USERPROFILE\.cache\opencode\packages\oh-my-openagent@4.13.0\node_modules\oh-my-openagent\dist\index.js"
# 应返回 True

# 检查 doctor
npx oh-my-openagent doctor
# 应显示 System OK

# 检查 agent 列表
opencode agent list
# 应包含 Sisyphus、Prometheus、Atlas、Oracle 等
```

重启 opencode，Agent 列表应该出现全部 OMO Agent。

## 总结

| 症状 | 可能原因 | 修复 |
|------|----------|------|
| doctor OK 但 Agent 列表不完整 | 配置作用域不匹配 | `opencode plugin oh-my-openagent@4.13.0` |
| 同上 | 缓存损坏（zod 等模块缺失） | 删除缓存后重装 |
| `agent list` 也不显示 OMO Agent | **多作用域配置污染 + 跨版本重复** | 彻底清空 → `bunx` 重装 |
| 启动慢 | 用了 `@latest` 标签 | 改成固定版本号 `@4.13.0` |

核心教训：

1. **版本定死，别用 `@latest`**：每次启动 opencode 都会检查 `@latest` 是否有更新，严重影响启动速度。
2. **别让多个 `.opencode/opencode.json` 共存**：OpenCode 会把所有层级的 plugin 数组合并，导致 OMO 检测到重复条目而拒绝加载。
3. **核武器比微调更快**：当症状是跨层级配置混乱 + 缓存污染，逐一排查不如一把清空重装。
4. **Desktop 的启动目录可能不是你项目目录**：检查开始菜单快捷方式的 `WorkingDirectory`。
