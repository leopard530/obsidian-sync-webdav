import { App } from 'obsidian';
import type { SyncState, SyncFileRecord } from './types';
import { EMPTY_SYNC_STATE } from './types';

/** Current schema version for forward compatibility */
const SCHEMA_VERSION = 1;

/**
 * SyncStateManager — persists sync state to .obsidian/plugins/obsidian-sync-webdav/sync-state.json
 * using Obsidian's VaultAdapter API (no Node.js fs).
 */
export class SyncStateManager {
	private state: SyncState;
	private readonly filePath: string;

	/**
	 * @param app - Obsidian App instance (for vault.adapter access)
	 * @param pluginBasePath - Plugin base directory path (e.g. '.obsidian/plugins/obsidian-sync-webdav')
	 */
	constructor(private readonly app: App, pluginBasePath: string) {
		// Ensure trailing slash normalized away by constructing clean path
		const base = pluginBasePath.replace(/\\/g, '/').replace(/\/+$/, '');
		this.filePath = `${base}/sync-state.json`;
		// Start with EMPTY_SYNC_STATE in memory; load() will populate it
		this.state = { ...EMPTY_SYNC_STATE, files: { ...EMPTY_SYNC_STATE.files } };
	}

	/**
	 * Load sync state from disk.
	 * If the file doesn't exist or is invalid/corrupt, returns EMPTY_SYNC_STATE.
	 * @returns Loaded or fallback SyncState
	 */
	async load(): Promise<SyncState> {
		try {
			const adapter = this.app.vault.adapter;
			if (!(await adapter.exists(this.filePath))) {
				this.state = { ...EMPTY_SYNC_STATE, files: { ...EMPTY_SYNC_STATE.files } };
				return this.state;
			}

			const content = await adapter.read(this.filePath);
			const parsed = JSON.parse(content) as Partial<SyncState>;

			// Validate schemaVersion
			if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion < 1) {
				// Unknown or missing schema — treat as corrupt, reset
				this.state = { ...EMPTY_SYNC_STATE, files: { ...EMPTY_SYNC_STATE.files } };
				return this.state;
			}

			// Forward-compatibility: higher schema versions are unknown —
			// still load but don't drop records
			if (parsed.schemaVersion > SCHEMA_VERSION) {
				// Future schema — load as-is but keep schemaVersion intact
				this.state = {
					schemaVersion: parsed.schemaVersion,
					files: parsed.files ?? {},
				};
			} else {
				// Current known schema
				this.state = {
					schemaVersion: parsed.schemaVersion,
					files: parsed.files ?? {},
				};
			}

			return this.state;
		} catch {
			// Parse error or read error — gracefully fall back to empty
			this.state = { ...EMPTY_SYNC_STATE, files: { ...EMPTY_SYNC_STATE.files } };
			return this.state;
		}
	}

	/**
	 * Save current in-memory state to disk.
	 * Uses Obsidian's adapter.write().
	 */
	async save(): Promise<void> {
		const json = JSON.stringify(this.state, null, 2);
		await this.app.vault.adapter.write(this.filePath, json);
	}

	/**
	 * Get the sync record for a normalized vault path.
	 * @param normalizedPath - Vault-relative path with forward-slash separators
	 * @returns The record if present, otherwise undefined
	 */
	getFileRecord(normalizedPath: string): SyncFileRecord | undefined {
		return this.state.files[normalizedPath];
	}

	/**
	 * Create or update a sync record for a file.
	 * Updates in-memory state and auto-saves to disk.
	 * @param normalizedPath - Vault-relative path with forward-slash separators
	 * @param record - SyncFileRecord to store
	 */
	async setFileRecord(normalizedPath: string, record: SyncFileRecord): Promise<void> {
		this.state.files[normalizedPath] = record;
		await this.save();
	}

	/**
	 * Remove the sync record for a file (e.g. when file is deleted locally).
	 * Updates in-memory state and auto-saves to disk.
	 * @param normalizedPath - Vault-relative path with forward-slash separators
	 */
	async removeFileRecord(normalizedPath: string): Promise<void> {
		delete this.state.files[normalizedPath];
		await this.save();
	}

	/**
	 * Clear all sync records and reset to empty state.
	 * Updates in-memory state and auto-saves to disk.
	 */
	async clear(): Promise<void> {
		this.state = { schemaVersion: SCHEMA_VERSION, files: {} };
		await this.save();
	}
}