/** Plugin settings persisted to data.json */
export interface WebDAVSyncSettings {
	/** WebDAV server URL, e.g. https://dav.example.com:5006/vault */
	webdavUrl: string;
	/** Login username */
	webdavUsername: string;
	/** Login password (stored in Obsidian's encrypted data.json when possible) */
	webdavPassword: string;
	/** Authentication type */
	authType: 'basic' | 'digest';
	/** Skip TLS certificate verification (for self-signed certs like FNOS) */
	skipTlsVerify: boolean;
	/** Auto-sync interval in minutes (0 = disabled) */
	syncInterval: number;
	/** Enable auto-sync on file changes */
	enableAutoSync: boolean;
	/** Debounce delay in seconds for auto-sync after file changes */
	debounceDelay: number;
	/** Conflict resolution strategy */
	conflictStrategy: ConflictStrategy;
	/** Remote path prefix (e.g. /vault/ — empty means root of WebDAV share) */
	remotePath: string;
}

export const DEFAULT_SETTINGS: WebDAVSyncSettings = {
	webdavUrl: '',
	webdavUsername: '',
	webdavPassword: '',
	authType: 'basic',
	skipTlsVerify: false,
	syncInterval: 5,
	enableAutoSync: true,
	debounceDelay: 10,
	conflictStrategy: 'keep-both',
	remotePath: '',
};

/** Conflict resolution strategies */
export type ConflictStrategy = 'keep-both' | 'local-wins' | 'remote-wins';

/** Per-file sync record stored in .sync_state.json */
export interface SyncFileRecord {
	/** SHA-256 hash of local file content at last sync */
	localSha256: string;
	/** Local file mtime (ms) at last sync */
	localMtime: number;
	/** Local file size (bytes) at last sync */
	localSize: number;
	/** Remote ETag at last sync */
	remoteEtag: string;
	/** Remote last-modified header at last sync */
	remoteLastModified: string;
	/** Remote file size (bytes) at last sync */
	remoteSize: number;
	/** ISO 8601 timestamp of last successful sync for this file */
	lastSyncTime: string;
}

/** Full sync state persisted to .sync_state.json */
export interface SyncState {
	/** Schema version for forward compatibility */
	schemaVersion: number;
	/** Map of normalized vault path → sync record */
	files: Record<string, SyncFileRecord>;
}

/** Initial empty sync state */
export const EMPTY_SYNC_STATE: SyncState = {
	schemaVersion: 1,
	files: {},
};

/** Remote file metadata from PROPFIND */
export interface WebDAVFileInfo {
	/** Normalized path relative to remote root */
	path: string;
	/** True if this is a directory (collection) */
	isDirectory: boolean;
	/** ETag value (may be quoted) */
	etag: string;
	/** Last modified date string from server */
	lastModified: string;
	/** Content length in bytes (0 for directories) */
	size: number;
	/** MIME type if available */
	contentType: string;
}

/** A pending sync action decided by the three-way comparison */
export interface SyncAction {
	/** Action type */
	type: 'upload' | 'download' | 'delete-remote' | 'delete-local' | 'skip' | 'conflict';
	/** Vault-relative file path */
	vaultPath: string;
	/** Remote path on WebDAV server */
	remotePath: string;
	/** For upload/conflict: local content to push */
	localContent?: string;
	/** For download: remote file info */
	remoteInfo?: WebDAVFileInfo;
	/** For rename: old path being renamed from */
	oldRemotePath?: string;
}

/** Sync operation result */
export interface SyncResult {
	/** Total actions processed */
	total: number;
	/** Successfully uploaded */
	uploaded: number;
	/** Successfully downloaded */
	downloaded: number;
	/** Successfully deleted from remote */
	deletedRemote: number;
	/** Successfully deleted locally */
	deletedLocal: number;
	/** Files skipped (no change) */
	skipped: number;
	/** Conflicts detected */
	conflicts: number;
	/** Errors encountered */
	errors: number;
	/** Per-file error messages */
	errorMessages: string[];
}
