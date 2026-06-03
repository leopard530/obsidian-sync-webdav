import { App, PluginSettingTab, Setting, Notice, requestUrl } from 'obsidian';
import type { WebDAVSyncSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import type ObsidianSyncWebDAV from './main';
import { t } from './i18n';
import { buildRemoteUrl } from './utils/path';

export class WebDAVSyncSettingTab extends PluginSettingTab {
	plugin: ObsidianSyncWebDAV;

	constructor(app: App, plugin: ObsidianSyncWebDAV) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: t('settings.title') });

		new Setting(containerEl)
			.setName(t('settings.url'))
			.setDesc(t('settings.url.desc'))
			.addText((text) =>
				text
					.setPlaceholder('https://dav.example.com:5006')
					.setValue(this.plugin.settings.webdavUrl)
					.onChange(async (value) => {
						this.plugin.settings.webdavUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t('settings.username'))
			.setDesc(t('settings.username.desc'))
			.addText((text) =>
				text
					.setPlaceholder('username')
					.setValue(this.plugin.settings.webdavUsername)
					.onChange(async (value) => {
						this.plugin.settings.webdavUsername = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t('settings.password'))
			.setDesc(t('settings.password.desc'))
			.addText((text) => {
				text.inputEl.type = 'password';
				text.setPlaceholder('password');
				text.setValue(this.plugin.settings.webdavPassword);
				text.onChange(async (value) => {
					this.plugin.settings.webdavPassword = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(t('settings.authType'))
			.setDesc(t('settings.authType.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('basic', t('settings.authType.basic'))
					.addOption('digest', t('settings.authType.digest'))
					.setValue(this.plugin.settings.authType)
					.onChange(async (value: string) => {
						this.plugin.settings.authType = value as 'basic' | 'digest';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t('settings.skipTls'))
			.setDesc(t('settings.skipTls.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.skipTlsVerify)
					.onChange(async (value) => {
						this.plugin.settings.skipTlsVerify = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t('settings.remotePath'))
			.setDesc(t('settings.remotePath.desc'))
			.addText((text) =>
				text
					.setPlaceholder('/vault')
					.setValue(this.plugin.settings.remotePath)
					.onChange(async (value) => {
						this.plugin.settings.remotePath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t('settings.autoSync'))
			.setDesc(t('settings.autoSync.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableAutoSync)
					.onChange(async (value) => {
						this.plugin.settings.enableAutoSync = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t('settings.syncInterval'))
			.setDesc(t('settings.syncInterval.desc'))
			.addText((text) =>
				text
					.setPlaceholder('5')
					.setValue(String(this.plugin.settings.syncInterval))
					.onChange(async (value) => {
						const interval = parseInt(value, 10);
						this.plugin.settings.syncInterval = isNaN(interval) ? 5 : interval;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t('settings.debounce'))
			.setDesc(t('settings.debounce.desc'))
			.addText((text) =>
				text
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.debounceDelay))
					.onChange(async (value) => {
						const delay = parseInt(value, 10);
						this.plugin.settings.debounceDelay = isNaN(delay) ? 10 : delay;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t('settings.conflict'))
			.setDesc(t('settings.conflict.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('keep-both', t('settings.conflict.keepBoth'))
					.addOption('local-wins', t('settings.conflict.localWins'))
					.addOption('remote-wins', t('settings.conflict.remoteWins'))
					.setValue(this.plugin.settings.conflictStrategy)
					.onChange(async (value: string) => {
						this.plugin.settings.conflictStrategy = value as 'keep-both' | 'local-wins' | 'remote-wins';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).addButton((button) =>
			button.setButtonText(t('settings.testBtn')).onClick(async () => {
				const settings = this.plugin.settings;

				if (!settings.webdavUrl) {
					new Notice(t('settings.test.emptyUrl'));
					return;
				}

				// Test the ACTUAL sync URL (base + remote path), not just the base.
				const testUrl = buildRemoteUrl(settings.webdavUrl, settings.remotePath, '');
				new Notice(`${t('settings.test.checking')} ${testUrl}`);

				try {
					const authCredentials = btoa(`${settings.webdavUsername}:${settings.webdavPassword}`);
				const headers: Record<string, string> = { Depth: '0' };
				if (settings.authType === 'basic') {
					headers['Authorization'] = `Basic ${authCredentials}`;
				}

				const response = await requestUrl({
					url: testUrl,
					method: 'PROPFIND',
					headers,
						throw: false,
					});

					if (response.status === 207) {
						new Notice(t('settings.test.success'));
					} else {
						new Notice(`${t('settings.test.failed')} ${response.status} — ${testUrl}`);
					}
				} catch (error: any) {
					new Notice(`${t('settings.test.error')} ${error.message || 'Unknown error'}`);
				}
			})
		);
	}
}

export type { WebDAVSyncSettings };
export { DEFAULT_SETTINGS };
