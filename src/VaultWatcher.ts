import { App, TFile, TAbstractFile, EventRef } from 'obsidian';
import { SyncEngine } from './SyncEngine';
import type { WebDAVSyncSettings } from './types';

const MARKDOWN_EXTENSIONS = new Set(['md']);
const ATTACHMENT_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'pdf', 'webp']);
const OBSIDIAN_DIR = '.obsidian';
const SYNC_STATE_FILE = '.sync_state.json';

/**
 * Checks if a file path should be watched (markdown or attachment files only).
 */
function isWatchedFile(path: string): boolean {
	// Ignore files in .obsidian/ directory
	if (path.includes(`/${OBSIDIAN_DIR}/`) || path.startsWith(`${OBSIDIAN_DIR}/`)) {
		return false;
	}

	// Ignore .sync_state.json
	if (path.endsWith(SYNC_STATE_FILE)) {
		return false;
	}

	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	return MARKDOWN_EXTENSIONS.has(ext) || ATTACHMENT_EXTENSIONS.has(ext);
}

/**
 * Vault event listener that detects file changes and triggers debounced sync.
 */
export class VaultWatcher {
	private readonly app: App;
	private readonly syncEngine: SyncEngine;
	private readonly settings: WebDAVSyncSettings;

	private eventRefs: EventRef[] = [];
	private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(app: App, syncEngine: SyncEngine, settings: WebDAVSyncSettings) {
		this.app = app;
		this.syncEngine = syncEngine;
		this.settings = settings;
	}

	/**
	 * Register all vault event listeners.
	 */
	start(): void {
		if (!this.settings.enableAutoSync) {
			return;
		}

		const debounceMs = this.settings.debounceDelay * 1000;

		// Handle file creation
		const onCreate = (file: TAbstractFile): void => {
			if (!(file instanceof TFile)) return;
			if (!isWatchedFile(file.path)) return;

			this.debouncedSync(file.path, 'upload', debounceMs);
		};
		this.eventRefs.push(this.app.vault.on('create', onCreate));

		// Handle file modification
		const onModify = (file: TAbstractFile): void => {
			if (!(file instanceof TFile)) return;
			if (!isWatchedFile(file.path)) return;

			this.debouncedSync(file.path, 'upload', debounceMs);
		};
		this.eventRefs.push(this.app.vault.on('modify', onModify));

		// Handle file deletion
		const onDelete = (file: TAbstractFile): void => {
			if (!isWatchedFile(file.path)) return;

			this.debouncedSync(file.path, 'delete', debounceMs);
		};
		this.eventRefs.push(this.app.vault.on('delete', onDelete));

		// Handle file rename
		const onRename = (file: TAbstractFile, oldPath: string): void => {
			if (!(file instanceof TFile)) return;
			if (!isWatchedFile(file.path)) return;

			// Clean up any pending debounce for the old path
			const oldTimer = this.debounceTimers.get(oldPath);
			if (oldTimer !== undefined) {
				clearTimeout(oldTimer);
				this.debounceTimers.delete(oldPath);
			}

			this.debouncedSync(file.path, 'rename', debounceMs, oldPath);
		};
		this.eventRefs.push(this.app.vault.on('rename', onRename));
	}

	/**
	 * Unregister all event listeners.
	 */
	stop(): void {
		for (const ref of this.eventRefs) {
			this.app.vault.offref(ref);
		}
		this.eventRefs = [];

		// Clear all pending debounce timers
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
	}

	/**
	 * Debounce sync calls per file path.
	 */
	private debouncedSync(
		path: string,
		type: 'upload' | 'delete' | 'rename',
		delay: number,
		oldPath?: string
	): void {
		// Reset existing timer for this path
		const existingTimer = this.debounceTimers.get(path);
		if (existingTimer !== undefined) {
			clearTimeout(existingTimer);
		}

		const timer = setTimeout(() => {
			this.debounceTimers.delete(path);
			this.syncEngine.syncFile(path, type, oldPath);
		}, delay);

		this.debounceTimers.set(path, timer);
	}
}