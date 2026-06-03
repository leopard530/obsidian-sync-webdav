/**
 * Path utilities for safe cross-server WebDAV path handling.
 */

/**
 * Normalize a path for consistent comparison and storage.
 * - Converts backslashes to forward slashes
 * - Removes duplicate slashes
 * - Removes leading/trailing slashes
 * - Decodes URI-encoded characters
 */
export function normalizePath(path: string): string {
	let normalized = path
		.replace(/\\/g, '/')
		.replace(/\/+/g, '/')
		.replace(/^\/+/, '')
		.replace(/\/+$/, '');
	
	try {
		normalized = decodeURIComponent(normalized);
	} catch {
		// If already decoded or malformed, keep as-is
	}
	
	return normalized;
}

/**
 * Encode a path segment for use in a URL.
 * Preserves slashes, encodes special characters.
 * Handles Chinese characters and other non-ASCII properly via UTF-8.
 */
export function encodePath(path: string): string {
	return path
		.split('/')
		.map(segment => {
			// encodeURIComponent encodes everything except: A-Z a-z 0-9 - _ . ! ~ * ' ( )
			// We also want to keep @ and + unencoded for some servers
			const encoded = encodeURIComponent(segment);
			// Some servers (e.g. QNAP) don't like certain encoded chars in paths.
			// %2F should remain as / in the path — we split by / first to avoid this.
			return encoded;
		})
		.join('/');
}

/**
 * Build the full remote URL for a vault path.
 * @param baseUrl - Server base URL (no trailing slash)
 * @param remotePath - Path prefix on server (e.g. "/vault")
 * @param vaultPath - Vault-relative path (e.g. "notes/readme.md")
 */
export function buildRemoteUrl(baseUrl: string, remotePath: string, vaultPath: string): string {
	const base = baseUrl.replace(/\/+$/, '');
	const prefix = remotePath.replace(/^\/+/, '').replace(/\/+$/, '');
	const path = encodePath(vaultPath);
	
	const parts: string[] = [base];
	if (prefix) parts.push(prefix);
	parts.push(path);
	
	return parts.join('/');
}

/**
 * Join path segments, normalizing slashes between them.
 */
export function joinPath(...segments: string[]): string {
	return segments
		.map(s => s.replace(/^\/+|\/+$/g, ''))
		.filter(s => s.length > 0)
		.join('/');
}

/**
 * Compare two paths for equality (case-insensitive, normalized).
 */
export function pathsMatch(a: string, b: string): boolean {
	return normalizePath(a).toLowerCase() === normalizePath(b).toLowerCase();
}
