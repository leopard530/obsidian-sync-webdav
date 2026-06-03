/**
 * i18n — bilingual locale system (zh-CN default, en fallback).
 */

export type Locale = 'zh-CN' | 'en';

const messages: Record<Locale, Record<string, string>> = {
	'zh-CN': {
		// ─── Settings UI ──────────────────────────────
		'settings.title': 'WebDAV 同步设置',
		'settings.url': 'WebDAV 地址',
		'settings.url.desc': 'WebDAV 服务器地址（例如 https://dav.example.com:5006）',
		'settings.username': '用户名',
		'settings.username.desc': 'WebDAV 登录用户名',
		'settings.password': '密码',
		'settings.password.desc': 'WebDAV 登录密码',
		'settings.authType': '认证方式',
		'settings.authType.desc': '认证方式',
		'settings.authType.basic': 'Basic 认证',
		'settings.authType.digest': 'Digest 认证',
		'settings.skipTls': '跳过 TLS 证书验证',
		'settings.skipTls.desc': '跳过 TLS 证书验证（适用于 FNOS 等自签名证书）',
		'settings.remotePath': '远程路径前缀',
		'settings.remotePath.desc': '同步的远程路径前缀（如 /vault）',
		'settings.autoSync': '启用自动同步',
		'settings.autoSync.desc': '定时自动同步文件变更',
		'settings.syncInterval': '自动同步间隔（分钟）',
		'settings.syncInterval.desc': '定时同步的间隔分钟数（0 = 禁用）',
		'settings.debounce': '防抖延迟（秒）',
		'settings.debounce.desc': '文件变更后延迟多少秒再触发同步',
		'settings.conflict': '冲突处理策略',
		'settings.conflict.desc': '同步冲突时的处理方式',
		'settings.conflict.keepBoth': '保留双方',
		'settings.conflict.localWins': '本地优先',
		'settings.conflict.remoteWins': '远程优先',
		'settings.testBtn': '测试连接',
		'settings.test.emptyUrl': '请先输入 WebDAV 地址',
		'settings.test.checking': '正在测试连接...',
		'settings.test.success': '✓ 连接成功！WebDAV 服务器可达。',
		'settings.test.failed': '✗ 连接失败：HTTP',
		'settings.test.error': '✗ 连接错误：',

		// ─── Main plugin ─────────────────────────────
		'ribbon.tooltip': '同步到 WebDAV',
		'command.syncNow': '立即同步',
		'statusBar.text': 'WebDAV 同步',
		'sync.noUrl': 'WebDAV 同步：请先在设置中配置 WebDAV 地址',
		'sync.starting': 'WebDAV 同步：开始同步...',
		'sync.upToDate': 'WebDAV 同步：所有文件已是最新',
		'sync.result': 'WebDAV 同步',
		'sync.errors': 'WebDAV 同步：${n} 个错误，请查看控制台。',
		'sync.failed': 'WebDAV 同步：同步失败 — ${msg}',
		'sync.skipped': '${n} 跳过',
		'sync.noRemoteFiles': 'WebDAV 同步：未扫描到远程文件。请检查 WebDAV 地址和远程路径配置，打开控制台 (Ctrl+Shift+I) 查看详细日志。',

		// ─── SyncEngine ──────────────────────────────
		'conflict.saved': '冲突：远程版本已保存为 "${path}"',
		'conflict.downloadFailed': '冲突：无法下载远程版本 "${path}"',
	},

	en: {
		'settings.title': 'WebDAV Sync Settings',
		'settings.url': 'WebDAV URL',
		'settings.url.desc': 'The URL of your WebDAV server (e.g., https://dav.example.com:5006)',
		'settings.username': 'Username',
		'settings.username.desc': 'Username for WebDAV authentication',
		'settings.password': 'Password',
		'settings.password.desc': 'Password for WebDAV authentication',
		'settings.authType': 'Auth Type',
		'settings.authType.desc': 'Authentication method',
		'settings.authType.basic': 'Basic Auth',
		'settings.authType.digest': 'Digest Auth',
		'settings.skipTls': 'Skip TLS Verification',
		'settings.skipTls.desc': 'Skip TLS certificate verification (for self-signed certificates like FNOS)',
		'settings.remotePath': 'Remote Path Prefix',
		'settings.remotePath.desc': 'Remote path prefix for sync (e.g., /vault)',
		'settings.autoSync': 'Enable Auto-sync',
		'settings.autoSync.desc': 'Automatically sync changes at regular intervals',
		'settings.syncInterval': 'Auto-sync Interval (minutes)',
		'settings.syncInterval.desc': 'Interval in minutes for automatic sync (0 = disabled)',
		'settings.debounce': 'Debounce Delay (seconds)',
		'settings.debounce.desc': 'Delay in seconds before triggering sync after changes',
		'settings.conflict': 'Conflict Strategy',
		'settings.conflict.desc': 'How to handle sync conflicts',
		'settings.conflict.keepBoth': 'Keep Both',
		'settings.conflict.localWins': 'Local Wins',
		'settings.conflict.remoteWins': 'Remote Wins',
		'settings.testBtn': 'Test Connection',
		'settings.test.emptyUrl': 'Please enter a WebDAV URL first',
		'settings.test.checking': 'Testing connection...',
		'settings.test.success': '✓ Connection successful! WebDAV server is reachable.',
		'settings.test.failed': '✗ Connection failed: HTTP',
		'settings.test.error': '✗ Connection error:',

		'ribbon.tooltip': 'Sync with WebDAV',
		'command.syncNow': 'Sync now',
		'statusBar.text': 'WebDAV Sync',
		'sync.noUrl': 'WebDAV Sync: Please configure WebDAV URL in settings first',
		'sync.starting': 'WebDAV Sync: Starting sync...',
		'sync.upToDate': 'WebDAV Sync: Everything up to date',
		'sync.result': 'WebDAV Sync',
		'sync.errors': 'WebDAV Sync: ${n} error(s). Check console for details.',
		'sync.failed': 'WebDAV Sync: Sync failed — ${msg}',
		'sync.skipped': '${n} skipped',
		'sync.noRemoteFiles': 'WebDAV Sync: No remote files found. Check WebDAV URL and Remote Path settings, then open console (Ctrl+Shift+I) for detailed logs.',

		'conflict.saved': 'Conflict: saved remote version as "${path}"',
		'conflict.downloadFailed': 'Conflict: could not download remote version of "${path}"',
	},
};

let currentLocale: Locale = 'zh-CN';

/**
 * Get translated string with optional variable substitution.
 * Supports ${var} placeholders.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
	let msg = messages[currentLocale]?.[key] ?? messages['en']?.[key] ?? key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			msg = msg.replace(new RegExp(`\\$\\{${k}\\}`, 'g'), String(v));
		}
	}
	return msg;
}

export function setLocale(locale: Locale): void {
	currentLocale = locale;
}

export function getLocale(): Locale {
	return currentLocale;
}
