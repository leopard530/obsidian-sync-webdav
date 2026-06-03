# WebDAV Sync

[English](#english) | [中文](#chinese)

---

<a name="chinese"></a>

## 中文

Obsidian WebDAV 双向同步插件。通过 WebDAV 协议将你的 Obsidian 笔记库与远程服务器保持同步，适用于自建 NAS、私有云等场景。

### 功能特性

- **双向同步** — 本地与远程文件互相推送/拉取，始终保持一致
- **增量同步** — 文件变更时自动触发（创建、修改、删除、重命名），可配置防抖延迟
- **定时同步** — 按指定间隔自动全量同步
- **三向对比算法** — 基于 SHA-256 + ETag + 同步状态记录，精准判断文件变更方向
- **冲突处理** — 支持三种策略：保留双方 / 本地优先 / 远程优先
- **文件监听** — 实时监听 Vault 文件变更（新建、修改、删除、重命名）
- **多格式支持** — Markdown、图片、PDF 等所有附件
- **一键同步** — 侧边栏按钮、状态栏点击、命令面板均可触发
- **连接测试** — 设置面板内置连接测试，快速验证配置
- **双语界面** — 支持中文 / 英文切换

### 支持的 WebDAV 服务

| 平台 | 状态 |
|------|------|
| FNOS (飞牛 OS) | 已测试 |
| Synology (群晖) | 已测试 |
| QNAP (威联通) | 已测试 |
| Nextcloud | 已测试 |
| 其他标准 WebDAV 服务 | 理论上兼容 |

### 安装

#### 手动安装

1. 从 [Releases](https://github.com/leopard530/obsidian-sync-webdav/releases) 下载 `main.js`、`styles.css` 和 `manifest.json`
2. 放入 Obsidian Vault 的 `.obsidian/plugins/obsidian-sync-webdav/` 目录
3. 在 Obsidian 设置 → 第三方插件中启用

#### 通过 BRAT 安装

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 添加 Beta 插件：`https://github.com/leopard530/obsidian-sync-webdav`

### 配置

打开 Obsidian 设置 → WebDAV 同步设置：

| 设置项 | 说明 | 示例 |
|--------|------|------|
| **WebDAV 地址** | WebDAV 服务器地址 | `https://dav.example.com:5006` |
| **用户名** | 登录用户名 | `admin` |
| **密码** | 登录密码 | — |
| **认证方式** | Basic 或 Digest 认证 | 推荐 Basic |
| **跳过 TLS 验证** | 自签名证书时启用（如 FNOS） | 关闭 |
| **远程路径前缀** | 同步文件存放的子目录 | `/vault` |
| **启用自动同步** | 自动同步文件变更 | 开启 |
| **同步间隔（分钟）** | 定时全量同步间隔 | `5` |
| **防抖延迟（秒）** | 文件变更后延迟触发同步 | `10` |
| **冲突处理策略** | 保留双方 / 本地优先 / 远程优先 | 保留双方 |

配置完成后点击「测试连接」验证配置是否正确。

### 同步原理

```
┌──────────┐     SHA-256      ┌──────────────┐     ETag        ┌──────────┐
│ 本地文件  │ ◄──────────────► │  Sync State   │ ◄─────────────► │ 远程文件  │
└──────────┘                   └──────────────┘                 └──────────┘
       │                              │                                │
       └──────────────────────────────┼────────────────────────────────┘
                                      │
                              三向对比决策：
                         • 仅本地变更 → 上传
                         • 仅远程变更 → 下载
                         • 双方变更 → 冲突处理
                         • 无变更   → 跳过
```

### 开发

```bash
# 克隆仓库
git clone https://github.com/leopard530/obsidian-sync-webdav.git
cd obsidian-sync-webdav

# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 生产构建
npm run build
```

构建产物在 `dist/` 目录下，将 `dist/main.js`、`dist/manifest.json`、`dist/styles.css` 复制到 `.obsidian/plugins/obsidian-sync-webdav/` 即可。

### 常见问题

**Q: 提示"未扫描到远程文件"？**
A: 检查 WebDAV 地址和远程路径配置是否正确。打开控制台 (Ctrl+Shift+I) 查看详细日志。

**Q: 同步失败 / 连接超时？**
A: 确认 WebDAV 服务正在运行，检查防火墙和端口是否开放。FNOS 等自签名证书环境需要开启「跳过 TLS 验证」。

**Q: Digest 认证不工作？**
A: 大部分国产 NAS（FNOS、群晖、威联通）仅支持 Basic 认证。Digest 认证目前回退到 Basic，后续版本将实现完整支持。

**Q: 如何重置同步状态？**
A: 删除 `.obsidian/plugins/obsidian-sync-webdav/sync-state.json` 文件，下次同步将重新建立状态。

---

<a name="english"></a>

## English

Obsidian WebDAV bidirectional sync plugin. Keep your vault synchronized with a remote WebDAV server — ideal for self-hosted NAS and private cloud setups.

### Features

- **Bidirectional Sync** — Push and pull files between local and remote, always stay in sync
- **Incremental Sync** — Auto-sync on file changes (create, modify, delete, rename) with configurable debounce
- **Periodic Sync** — Full sync at configurable intervals
- **Three-way Comparison** — SHA-256 + ETag + sync state records for precise change detection
- **Conflict Resolution** — Three strategies: keep both / local wins / remote wins
- **File Watching** — Real-time vault event monitoring
- **Multi-format** — Markdown, images, PDFs, and all attachments
- **One-click Sync** — Ribbon icon, status bar, or command palette
- **Connection Test** — Built-in connection test in settings
- **Bilingual UI** — Chinese / English

### Supported WebDAV Servers

| Platform | Status |
|----------|--------|
| FNOS | Tested |
| Synology | Tested |
| QNAP | Tested |
| Nextcloud | Tested |
| Other standard WebDAV | Should work |

### Installation

#### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from [Releases](https://github.com/leopard530/obsidian-sync-webdav/releases)
2. Place them in `.obsidian/plugins/obsidian-sync-webdav/` inside your vault
3. Enable the plugin in Obsidian Settings → Community Plugins

#### Via BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add beta plugin: `https://github.com/leopard530/obsidian-sync-webdav`

### Configuration

| Setting | Description | Example |
|---------|-------------|---------|
| **WebDAV URL** | Server address | `https://dav.example.com:5006` |
| **Username** | Login username | `admin` |
| **Password** | Login password | — |
| **Auth Type** | Basic or Digest | Basic (recommended) |
| **Skip TLS Verify** | For self-signed certs (e.g. FNOS) | Off |
| **Remote Path** | Subdirectory for synced files | `/vault` |
| **Enable Auto-sync** | Auto-sync on changes | On |
| **Sync Interval (min)** | Full sync interval | `5` |
| **Debounce Delay (s)** | Delay before sync after changes | `10` |
| **Conflict Strategy** | keep both / local wins / remote wins | Keep Both |

Use the "Test Connection" button to verify your configuration.

### Development

```bash
git clone https://github.com/leopard530/obsidian-sync-webdav.git
cd obsidian-sync-webdav
npm install
npm run dev      # Dev mode with hot reload
npm run build    # Production build
```

Copy `dist/main.js`, `dist/manifest.json`, `dist/styles.css` to `.obsidian/plugins/obsidian-sync-webdav/`.

### FAQ

**Q: "No remote files found"?**
A: Check WebDAV URL and Remote Path settings. Open console (Ctrl+Shift+I) for detailed logs.

**Q: Sync fails / connection timeout?**
A: Verify the WebDAV service is running and firewall/ports are open. For FNOS and self-signed certificates, enable "Skip TLS Verify".

**Q: Digest auth not working?**
A: Most NAS devices (FNOS, Synology, QNAP) only support Basic auth. Digest currently falls back to Basic; full support planned.

**Q: How to reset sync state?**
A: Delete `.obsidian/plugins/obsidian-sync-webdav/sync-state.json` — next sync will rebuild state from scratch.

---

## License

[Apache-2.0](LICENSE)
