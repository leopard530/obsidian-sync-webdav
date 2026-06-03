import { Notice, Plugin, normalizePath } from 'obsidian';
import type { WebDAVSyncSettings, SyncResult } from './types';
import { DEFAULT_SETTINGS } from './types';
import { WebDAVSyncSettingTab } from './settings';
import { WebDAVClient } from './WebDAVClient';
import { SyncStateManager } from './SyncState';
import { SyncEngine } from './SyncEngine';
import { VaultWatcher } from './VaultWatcher';
import { t } from './i18n';

export default class ObsidianSyncWebDAV extends Plugin {
	settings!: WebDAVSyncSettings;
	private client!: WebDAVClient;
	private stateManager!: SyncStateManager;
	private syncEngine!: SyncEngine;
	private vaultWatcher!: VaultWatcher;
	private syncIntervalId: ReturnType<typeof setInterval> | null = null;
	private statusBarEl!: HTMLElement;

	async onload() {
		console.log('WebDAV Sync: loading plugin');

		await this.loadSettings();

		// Initialize modules
		const pluginBasePath = normalizePath(`${this.app.vault.configDir}/plugins/obsidian-sync-webdav`);
		this.stateManager = new SyncStateManager(this.app, pluginBasePath);
		this.client = new WebDAVClient(
			this.settings.webdavUrl,
			this.settings.webdavUsername,
			this.settings.webdavPassword,
			this.settings.authType,
			this.settings.skipTlsVerify,
			this.settings.remotePath,
		);
		this.syncEngine = new SyncEngine(this.app, this.client, this.stateManager, this.settings);
		this.vaultWatcher = new VaultWatcher(this.app, this.syncEngine, this.settings);

		// Start file watching
		this.vaultWatcher.start();

		// Ribbon icon
		const ribbonIcon = this.addRibbonIcon('refresh-cw', t('ribbon.tooltip'), async () => {
			await this.runSync();
		});
		ribbonIcon.addClass('webdav-sync-ribbon');

		// Status bar
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.setText(t('statusBar.text'));
		this.statusBarEl.addClass('webdav-sync-status');
		this.statusBarEl.addEventListener('click', () => this.runSync());

		// Register command
		this.addCommand({
			id: 'sync-webdav-now',
			name: t('command.syncNow'),
			callback: () => this.runSync(),
		});

		// Settings tab
		this.addSettingTab(new WebDAVSyncSettingTab(this.app, this));

		// Periodic sync
		this.setupPeriodicSync();
	}

	onunload() {
		console.log('WebDAV Sync: unloading plugin');
		this.vaultWatcher?.stop();
		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data as Partial<WebDAVSyncSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		this.client = new WebDAVClient(
			this.settings.webdavUrl,
			this.settings.webdavUsername,
			this.settings.webdavPassword,
			this.settings.authType,
			this.settings.skipTlsVerify,
			this.settings.remotePath,
		);
		this.syncEngine = new SyncEngine(this.app, this.client, this.stateManager, this.settings);

		this.vaultWatcher.stop();
		this.vaultWatcher = new VaultWatcher(this.app, this.syncEngine, this.settings);
		this.vaultWatcher.start();

		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
		}
		this.setupPeriodicSync();
	}

	private async runSync(): Promise<void> {
		if (!this.settings.webdavUrl) {
			new Notice(t('sync.noUrl'));
			return;
		}

		const notice = new Notice(t('sync.starting'), 0);

		try {
			const result: SyncResult = await this.syncEngine.fullSync();

			notice.hide();

			const parts: string[] = [];
			if (result.uploaded > 0) parts.push(`↑${result.uploaded}`);
			if (result.downloaded > 0) parts.push(`↓${result.downloaded}`);
			if (result.deletedRemote > 0) parts.push(`-${result.deletedRemote}r`);
			if (result.conflicts > 0) parts.push(`⚠${result.conflicts}`);
			if (result.skipped > 0) parts.push(t('sync.skipped', { n: result.skipped }));

			const msg = parts.length > 0
				? `${t('sync.result')}: ${parts.join(' ')}`
				: t('sync.upToDate');

			new Notice(msg);

			if (result.errors > 0) {
				new Notice(t('sync.errors', { n: result.errors }));
				console.error('WebDAV Sync errors:', result.errorMessages);
			}
		} catch (err: any) {
			notice.hide();
			new Notice(t('sync.failed', { msg: err?.message ?? 'Unknown error' }));
			console.error('WebDAV Sync: sync error:', err);
		}
	}

	private setupPeriodicSync(): void {
		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}

		const interval = this.settings.syncInterval;
		if (interval > 0 && this.settings.enableAutoSync) {
			this.syncIntervalId = setInterval(() => {
				this.runSync();
			}, interval * 60 * 1000);
			this.syncIntervalId.unref?.();
		}
	}
}
