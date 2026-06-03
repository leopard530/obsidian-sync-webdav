/**
 * SyncEngine — core bidirectional sync logic using three-way comparison.
 *
 * Algorithm:
 *   For each file path in Local ∪ Remote:
 *     Compare: Local state vs SyncRecord vs Remote state
 *     Determine action based on which sides changed.
 */

import { App, TFile, normalizePath, Notice } from 'obsidian';
import type { WebDAVSyncSettings, SyncResult, SyncFileRecord, WebDAVFileInfo } from './types';
import { WebDAVClient } from './WebDAVClient';
import { SyncStateManager } from './SyncState';
import { t } from './i18n';

export class SyncEngine {
	private readonly app: App;
	private readonly client: WebDAVClient;
	private readonly stateManager: SyncStateManager;
	private readonly settings: WebDAVSyncSettings;
	private isSyncing = false;

	constructor(
		app: App,
		client: WebDAVClient,
		stateManager: SyncStateManager,
		settings: WebDAVSyncSettings,
	) {
		this.app = app;
		this.client = client;
		this.stateManager = stateManager;
		this.settings = settings;
	}

	// ─── Full Sync ────────────────────────────────────────────

	async fullSync(): Promise<SyncResult> {
		if (this.isSyncing) {
			console.log('SyncEngine: sync already in progress, skipping');
			return { total: 0, uploaded: 0, downloaded: 0, deletedRemote: 0, deletedLocal: 0, skipped: 0, conflicts: 0, errors: 0, errorMessages: [] };
		}

		this.isSyncing = true;
		const result: SyncResult = {
			total: 0, uploaded: 0, downloaded: 0,
			deletedRemote: 0, deletedLocal: 0,
			skipped: 0, conflicts: 0, errors: 0,
			errorMessages: [],
		};

		try {
			// 1. Load current sync state
			await this.stateManager.load();

			// 2. Scan local files (all types: md, png, pdf, etc.)
			const allFiles = this.app.vault.getFiles();
			const localFiles = allFiles.filter((f) => {
				const p = normalizePath(f.path);
				// Exclude hidden dirs and plugin config
				if (p.startsWith('.obsidian/') || p.startsWith('.trash/')) return false;
				if (p === '.sync_state.json') return false;
				return true;
			});
			const localPaths = new Set(localFiles.map((f) => normalizePath(f.path)));
			console.log(`[WebDAV Sync] Local files: ${localFiles.length} (excluded ${allFiles.length - localFiles.length})`);

			// 3. Scan remote files (recursively)
			const remoteFiles = await this.listAllRemoteFiles('');
			console.log(`[WebDAV Sync] Remote entries: ${remoteFiles.length}`);
			const remoteFileMap = new Map<string, WebDAVFileInfo>();
			for (const rf of remoteFiles) {
				if (!rf.isDirectory) {
					remoteFileMap.set(rf.path, rf);
				}
			}
			console.log(`[WebDAV Sync] Remote files: ${remoteFileMap.size}, directories: ${remoteFiles.length - remoteFileMap.size}`);

			if (remoteFiles.length === 0) {
				new Notice(t('sync.noRemoteFiles'), 8000);
			}

			// 4. Build union set
			const allPaths = new Set([...localPaths, ...remoteFileMap.keys()]);
			result.total = allPaths.size;

			// 5. For each path, decide and execute
			for (const vaultPath of allPaths) {
				try {
					const record = this.stateManager.getFileRecord(vaultPath);
					const localFile = localFiles.find((f) => normalizePath(f.path) === vaultPath);
					const remoteInfo = remoteFileMap.get(vaultPath);

					const localExists = !!localFile;
					const remoteExists = !!remoteInfo;
					const recordExists = !!record;

					// Compute local SHA-256 if file exists
					let localSha256 = '';
					if (localFile) {
						localSha256 = await this.computeSha256(localFile);
					}

					// Three-way decision
					if (localExists && remoteExists && recordExists) {
						// File exists in all three: compare
						const localChanged = localSha256 !== record.localSha256;
						const remoteChanged = (remoteInfo!.etag || '') !== (record.remoteEtag || '');

						if (!localChanged && !remoteChanged) {
							result.skipped++;
						} else if (localChanged && !remoteChanged) {
							await this.doUpload(localFile!, vaultPath, localSha256, remoteInfo!, result);
						} else if (!localChanged && remoteChanged) {
							await this.doDownload(vaultPath, remoteInfo!, result);
						} else {
							// Both changed — conflict
							await this.handleConflict(localFile!, vaultPath, localSha256, remoteInfo!, result);
						}
					} else if (localExists && !remoteExists) {
						// Local only — upload (new file)
						console.log(`[WebDAV Sync] Upload new local: ${vaultPath}`);
						await this.doUpload(localFile!, vaultPath, localSha256, undefined, result);
					} else if (!localExists && remoteExists) {
						if (recordExists) {
							// Remote exists, local deleted, record exists → delete remote
							console.log(`[WebDAV Sync] Delete remote (local deleted): ${vaultPath}`);
							await this.doDeleteRemote(vaultPath, result);
						} else {
							// Remote exists, no record → download (new remote file)
							console.log(`[WebDAV Sync] Download new remote: ${vaultPath}`);
							await this.doDownload(vaultPath, remoteInfo!, result);
						}
					} else {
						result.skipped++;
					}
				} catch (err: any) {
					result.errors++;
					result.errorMessages.push(`${vaultPath}: ${err?.message ?? 'Unknown error'}`);
					console.error(`SyncEngine: error syncing ${vaultPath}:`, err);
				}
			}

			// 6. Save final state
			await this.stateManager.save();

			console.log(`[WebDAV Sync] Done: ↑${result.uploaded} ↓${result.downloaded} -${result.deletedRemote}r ⚠${result.conflicts} …${result.skipped} ✗${result.errors}`);
			if (result.errorMessages.length > 0) {
				console.error('[WebDAV Sync] Errors:', result.errorMessages);
			}
		} finally {
			this.isSyncing = false;
		}

		return result;
	}

	// ─── Incremental Sync ─────────────────────────────────────

	async syncFile(path: string, type: 'upload' | 'delete' | 'rename', oldPath?: string): Promise<void> {
		try {
			const vaultPath = normalizePath(path);

			// Wait for ongoing full sync to finish
			while (this.isSyncing) {
				await new Promise((r) => setTimeout(r, 100));
			}

			await this.stateManager.load();

			if (type === 'upload') {
				const file = this.app.vault.getAbstractFileByPath(vaultPath);
				if (!(file instanceof TFile)) return;

				const localSha256 = await this.computeSha256(file);
				const content = await this.app.vault.read(file);
				await this.client.uploadFile(vaultPath, content);

				// Get accurate ETag from server after upload
				const stat = await this.client.statFile(vaultPath);
				const record: SyncFileRecord = {
					localSha256,
					localMtime: file.stat.mtime,
					localSize: file.stat.size,
					remoteEtag: stat?.etag ?? '',
					remoteLastModified: stat?.lastModified ?? '',
					remoteSize: stat?.size ?? 0,
					lastSyncTime: new Date().toISOString(),
				};
				await this.stateManager.setFileRecord(vaultPath, record);
			} else if (type === 'delete') {
				await this.client.deleteFile(vaultPath);
				await this.stateManager.removeFileRecord(vaultPath);
			} else if (type === 'rename' && oldPath) {
				const oldVaultPath = normalizePath(oldPath);
				await this.client.moveFile(oldVaultPath, vaultPath);

				// Update state: move record from old path to new path
				const oldRecord = this.stateManager.getFileRecord(oldVaultPath);
				if (oldRecord) {
					await this.stateManager.setFileRecord(vaultPath, oldRecord);
				}
				await this.stateManager.removeFileRecord(oldVaultPath);
			}
		} catch (err: any) {
			console.error(`SyncEngine: syncFile failed for ${path}:`, err);
		}
	}

	// ─── Conflict Resolution ──────────────────────────────────

	private async handleConflict(
		localFile: TFile,
		vaultPath: string,
		localSha256: string,
		remoteInfo: WebDAVFileInfo,
		result: SyncResult,
	): Promise<void> {
		result.conflicts++;

		switch (this.settings.conflictStrategy) {
			case 'local-wins': {
				await this.doUpload(localFile, vaultPath, localSha256, remoteInfo, result);
				break;
			}
			case 'remote-wins': {
				await this.doDownload(vaultPath, remoteInfo, result);
				break;
			}
			case 'keep-both':
			default: {
				// Download remote as "filename (server conflict).md" and upload local
				const conflictPath = this.makeConflictPath(vaultPath);
				try {
					const remoteContent = await this.client.downloadFile(vaultPath);
					const dirPath = conflictPath.substring(0, conflictPath.lastIndexOf('/'));
					if (dirPath) {
						const dir = this.app.vault.getAbstractFileByPath(dirPath);
						if (!dir) {
							await this.app.vault.createFolder(dirPath);
						}
					}
					await this.app.vault.create(conflictPath, remoteContent);
					new Notice(t('conflict.saved', { path: conflictPath }));
				} catch {
					new Notice(t('conflict.downloadFailed', { path: vaultPath }));
				}
				// Upload local version
				await this.doUpload(localFile, vaultPath, localSha256, remoteInfo, result);
				break;
			}
		}
	}

	private makeConflictPath(originalPath: string): string {
		const dot = originalPath.lastIndexOf('.');
		const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		if (dot > 0) {
			return originalPath.slice(0, dot) + ` (server conflict ${now})` + originalPath.slice(dot);
		}
		return originalPath + ` (server conflict ${now})`;
	}

	// ─── Actions ──────────────────────────────────────────────

	private async doUpload(
		localFile: TFile,
		vaultPath: string,
		localSha256: string,
		_remoteInfo: WebDAVFileInfo | undefined,
		result: SyncResult,
	): Promise<void> {
		const content = await this.app.vault.read(localFile);
		await this.client.uploadFile(vaultPath, content);

		// Fetch the real ETag from the server after upload.
		// Avoids storing empty ETag which causes spurious re-download on next sync.
		const stat = await this.client.statFile(vaultPath);

		const record: SyncFileRecord = {
			localSha256,
			localMtime: localFile.stat.mtime,
			localSize: localFile.stat.size,
			remoteEtag: stat?.etag ?? '',
			remoteLastModified: stat?.lastModified ?? '',
			remoteSize: stat?.size ?? 0,
			lastSyncTime: new Date().toISOString(),
		};
		await this.stateManager.setFileRecord(vaultPath, record);
		result.uploaded++;
	}

	private async doDownload(
		vaultPath: string,
		remoteInfo: WebDAVFileInfo,
		result: SyncResult,
	): Promise<void> {
		const content = await this.client.downloadFile(vaultPath);

		// Use vault API so Obsidian properly indexes the file.
		// adapter.write() writes to disk but Obsidian won't detect it.
		const existingFile = this.app.vault.getAbstractFileByPath(vaultPath);
		if (existingFile instanceof TFile) {
			await this.app.vault.modify(existingFile, content);
		} else {
			// Ensure parent directories exist
			const dirPath = vaultPath.substring(0, vaultPath.lastIndexOf('/'));
			if (dirPath) {
				const dir = this.app.vault.getAbstractFileByPath(dirPath);
				if (!dir) {
					await this.app.vault.createFolder(dirPath);
				}
			}
			await this.app.vault.create(vaultPath, content);
		}

		// Compute local SHA-256 for the freshly downloaded file
		const arrayBuffer = new TextEncoder().encode(content).buffer;
		const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const localSha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

		const record: SyncFileRecord = {
			localSha256,
			localMtime: Date.now(),
			localSize: content.length,
			remoteEtag: remoteInfo.etag,
			remoteLastModified: remoteInfo.lastModified,
			remoteSize: remoteInfo.size,
			lastSyncTime: new Date().toISOString(),
		};
		await this.stateManager.setFileRecord(vaultPath, record);
		result.downloaded++;
	}

	private async doDeleteRemote(vaultPath: string, result: SyncResult): Promise<void> {
		await this.client.deleteFile(vaultPath);
		await this.stateManager.removeFileRecord(vaultPath);
		result.deletedRemote++;
	}

	// ─── Helpers ──────────────────────────────────────────────

	private async computeSha256(file: TFile): Promise<string> {
		const arrayBuffer = await this.app.vault.readBinary(file);
		const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Recursively list all files under the given remote path.
	 */
	private async listAllRemoteFiles(dirPath: string): Promise<WebDAVFileInfo[]> {
		const results: WebDAVFileInfo[] = [];
		const queue: string[] = [dirPath];
		const visited = new Set<string>([dirPath]);
		let dirsScanned = 0;

		while (queue.length > 0) {
			const current = queue.shift()!;
			const label = current || '(root)';
			try {
				const entries = await this.client.listFiles(current);
				dirsScanned++;

				const files = entries.filter(e => !e.isDirectory);
				const dirs = entries.filter(e => e.isDirectory);
				console.log(`[WebDAV Sync] Scan "${label}": ${entries.length} entries (${files.length} files, ${dirs.length} dirs)`);

				for (const entry of entries) {
					results.push(entry);
					if (entry.isDirectory && entry.path && !visited.has(entry.path)) {
						visited.add(entry.path);
						console.log(`[WebDAV Sync]   → queue subdir: "${entry.path}"`);
						queue.push(entry.path);
					}
				}
			} catch (err) {
				console.error(`[WebDAV Sync] Failed to list "${label}":`, err);
			}
		}

		console.log(`[WebDAV Sync] Scanned ${dirsScanned} directories, found ${results.length} total entries`);
		return results;
	}
}
