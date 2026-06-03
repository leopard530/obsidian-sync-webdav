/**
 * WebDAVClient — HTTP client for WebDAV operations using Obsidian's requestUrl.
 *
 * Supports: PROPFIND, GET, PUT, DELETE, MKCOL, MOVE
 * Handles: Basic/Digest auth, self-signed certs (FNOS), retry logic
 */

import { requestUrl } from 'obsidian';
import { buildRemoteUrl } from './utils/path';
import { parseMultiStatus, buildPropfindBody } from './utils/xml';
import type { WebDAVFileInfo } from './types';

export class WebDAVClient {
	private readonly baseUrl: string;
	private readonly username: string;
	private readonly password: string;
	private readonly authType: 'basic' | 'digest';
	private readonly remotePath: string;

	constructor(
		baseUrl: string,
		username: string,
		password: string,
		authType: 'basic' | 'digest',
		_skipTlsVerify: boolean,
		remotePath: string,
	) {
		// Normalize base URL: strip trailing slash
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.username = username;
		this.password = password;
		this.authType = authType;
		this.remotePath = remotePath;
	}

	// ─── Auth ─────────────────────────────────────────────────

	private getAuthHeaders(): Record<string, string> {
		if (this.authType === 'basic') {
			const credentials = btoa(`${this.username}:${this.password}`);
			return { Authorization: `Basic ${credentials}` };
		}
		// Digest auth: most Chinese NAS (FNOS, Synology, QNAP) only support Basic.
		// For servers that support Digest, fall back to Basic as a starting point.
		// TODO: implement Digest challenge-response if needed.
		const credentials = btoa(`${this.username}:${this.password}`);
		return { Authorization: `Basic ${credentials}` };
	}

	// ─── URL building ─────────────────────────────────────────

	private buildUrl(vaultPath: string): string {
		return buildRemoteUrl(this.baseUrl, this.remotePath, vaultPath);
	}

	// ─── Retry logic ──────────────────────────────────────────

	private async retry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
		let lastError: unknown;
		for (let i = 0; i <= maxRetries; i++) {
			try {
				return await fn();
			} catch (err: any) {
				lastError = err;
				const status = err?.status ?? 0;
				// Retry on auth, conflict, and server errors
				if (i < maxRetries && [401, 409, 502, 503, 504].includes(status)) {
					const delay = 1000 * Math.pow(2, i);
					console.warn(`WebDAV request failed with ${status}, retrying in ${delay}ms...`);
					await new Promise((r) => setTimeout(r, delay));
					continue;
				}
				throw err;
			}
		}
		throw lastError;
	}

	// ─── Public API ───────────────────────────────────────────

	/**
	 * Test if the WebDAV server is reachable and responding.
	 */
	async testConnection(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: this.baseUrl,
				method: 'PROPFIND',
				headers: {
					...this.getAuthHeaders(),
					Depth: '0',
					'Content-Type': 'application/xml',
				},
				body: buildPropfindBody(),
				throw: false,
			});
			return response.status === 207;
		} catch (err) {
			console.error('WebDAV testConnection failed:', err);
			return false;
		}
	}

	/**
	 * List files and directories at a given remote path.
	 * @param dirPath - Vault-relative directory path (empty string for root)
	 */
	async listFiles(dirPath: string): Promise<WebDAVFileInfo[]> {
		return this.retry(async () => {
			const url = this.buildUrl(dirPath);
			const response = await requestUrl({
				url,
				method: 'PROPFIND',
				headers: {
					...this.getAuthHeaders(),
					Depth: '1',
					'Content-Type': 'application/xml',
				},
				body: buildPropfindBody(),
				throw: false,
			});

			if (response.status !== 207) {
				console.warn(`[WebDAV Sync] PROPFIND ${url} → HTTP ${response.status}`);
				throw new Error(`PROPFIND failed: HTTP ${response.status}`);
			}

			const result = parseMultiStatus(response.text, this.baseUrl, this.remotePath);
			if (result.entries.length === 0 && response.text.length > 0) {
				// XML was received but parsing yielded nothing — likely namespace mismatch
				console.warn('[WebDAV Sync] PROPFIND returned XML but parser found 0 entries. First 300 chars:', response.text.substring(0, 300));
			}
			return result.entries;
		});
	}

	/**
	 * Get metadata for a single file via PROPFIND Depth: 0.
	 * Returns the file info with accurate ETag from the server.
	 */
	async statFile(remoteFilePath: string): Promise<WebDAVFileInfo | null> {
		try {
			const url = this.buildUrl(remoteFilePath);
			const response = await requestUrl({
				url,
				method: 'PROPFIND',
				headers: {
					...this.getAuthHeaders(),
					Depth: '0',
					'Content-Type': 'application/xml',
				},
				body: buildPropfindBody(),
				throw: false,
			});

			if (response.status !== 207) return null;

			const result = parseMultiStatus(response.text, this.baseUrl, this.remotePath);
			// Find the entry matching this specific file
			const fileEntry = result.entries.find((e) => !e.isDirectory);
			return fileEntry ?? null;
		} catch (err) {
			console.error(`statFile failed for ${remoteFilePath}:`, err);
			return null;
		}
	}

	/**
	 * Download a file's content from the remote server.
	 * @param remoteFilePath - Vault-relative file path
	 */
	async downloadFile(remoteFilePath: string): Promise<string> {
		return this.retry(async () => {
			const url = this.buildUrl(remoteFilePath);
			const response = await requestUrl({
				url,
				method: 'GET',
				headers: this.getAuthHeaders(),
				throw: false,
			});

			if (response.status < 200 || response.status >= 300) {
				throw new Error(`GET failed for ${remoteFilePath}: HTTP ${response.status}`);
			}

			return response.text;
		});
	}

	/**
	 * Download a file's content as binary data from the remote server.
	 * @param remoteFilePath - Vault-relative file path
	 */
	async downloadFileBinary(remoteFilePath: string): Promise<ArrayBuffer> {
		return this.retry(async () => {
			const url = this.buildUrl(remoteFilePath);
			const response = await requestUrl({
				url,
				method: 'GET',
				headers: this.getAuthHeaders(),
				throw: false,
			});

			if (response.status < 200 || response.status >= 300) {
				throw new Error(`GET failed for ${remoteFilePath}: HTTP ${response.status}`);
			}

			return response.arrayBuffer;
		});
	}

	/**
	 * Upload file content to the remote server.
	 * @param remoteFilePath - Vault-relative file path
	 * @param content - File content as string or ArrayBuffer
	 * @param contentType - MIME type for the file
	 */
	async uploadFile(
		remoteFilePath: string,
		content: string | ArrayBuffer,
		contentType: string,
	): Promise<void> {
		return this.retry(async () => {
			const url = this.buildUrl(remoteFilePath);
			const response = await requestUrl({
				url,
				method: 'PUT',
				headers: {
					...this.getAuthHeaders(),
					'Content-Type': contentType,
				},
				body: content,
				throw: false,
			});

			if (response.status < 200 || response.status >= 300) {
				throw new Error(`PUT failed for ${remoteFilePath}: HTTP ${response.status}`);
			}
		});
	}

	/**
	 * Delete a file from the remote server.
	 * @param remoteFilePath - Vault-relative file path
	 */
	async deleteFile(remoteFilePath: string): Promise<void> {
		return this.retry(async () => {
			const url = this.buildUrl(remoteFilePath);
			const response = await requestUrl({
				url,
				method: 'DELETE',
				headers: this.getAuthHeaders(),
				throw: false,
			});

			// 204 No Content is the normal success response.
			// 404 Not Found means the file doesn't exist — treat as success.
			if (response.status !== 204 && response.status !== 200 && response.status !== 404) {
				throw new Error(`DELETE failed for ${remoteFilePath}: HTTP ${response.status}`);
			}
		});
	}

	/**
	 * Create a directory on the remote server.
	 * @param remoteDirPath - Vault-relative directory path
	 */
	async createDirectory(remoteDirPath: string): Promise<void> {
		return this.retry(async () => {
			const url = this.buildUrl(remoteDirPath);
			const response = await requestUrl({
				url,
				method: 'MKCOL',
				headers: this.getAuthHeaders(),
				throw: false,
			});

			// 201 Created, 200 OK, 202 Accepted, 204 No Content: success
			// 405 Method Not Allowed: directory already exists (standard)
			// 401/403: some NAS (FNOS, etc.) return these instead of 405 for existing dirs
			const okStatuses = [200, 201, 202, 204, 401, 403, 405];
			if (!okStatuses.includes(response.status)) {
				throw new Error(`MKCOL failed for ${remoteDirPath}: HTTP ${response.status}`);
			}
		});
	}

	/**
	 * Move/rename a file on the remote server.
	 * @param fromPath - Vault-relative source path
	 * @param toPath - Vault-relative destination path
	 */
	async moveFile(fromPath: string, toPath: string): Promise<void> {
		return this.retry(async () => {
			const fromUrl = this.buildUrl(fromPath);
			const toUrl = this.buildUrl(toPath);
			const response = await requestUrl({
				url: fromUrl,
				method: 'MOVE',
				headers: {
					...this.getAuthHeaders(),
					Destination: toUrl,
				},
				throw: false,
			});

			if (response.status < 200 || response.status >= 300) {
				throw new Error(`MOVE failed for ${fromPath} → ${toPath}: HTTP ${response.status}`);
			}
		});
	}
}
