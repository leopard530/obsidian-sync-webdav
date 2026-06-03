/**
 * Robust PROPFIND XML parser with multi-namespace support.
 * Handles ANY namespace prefix (d:, D:, DAV:, ns0:, etc.) and unprefixed elements.
 *
 * Servers vary widely in their PROPFIND responses:
 * - Apache/mod_dav: uses D: namespace prefix
 * - nginx-dav-ext: may or may not use namespace prefix
 * - Nextcloud (SabreDAV): uses d: prefix, adds extra oc: namespace
 * - FNOS: uses D: or d: prefix, may vary
 * - Some servers use ns0:, ns1:, or other auto-generated prefixes
 */

import { WebDAVFileInfo } from '../types';

/** Matches any namespace prefix: d:, D:, DAV:, ns0:, etc. or no prefix at all */
const NS_PREFIX = '(?:\\w+:)?';

/** Result from parsing a multi-status response */
export interface MultiStatusResult {
	/** Parsed file/directory entries */
	entries: WebDAVFileInfo[];
	/** The base href for resolving relative paths */
	baseHref: string;
}

/**
 * Parse a PROPFIND multistatus XML response.
 * Matches response/href/propstat elements with any namespace prefix.
 */
export function parseMultiStatus(xml: string, baseUrl: string, remotePath: string): MultiStatusResult {
	const entries: WebDAVFileInfo[] = [];
	let baseHref = '';

	// Normalize remote path for comparison
	const remotePrefix = remotePath.replace(/^\/+|\/+$/g, '');

	try {
		// Match <response> or <ns:response> blocks (any namespace prefix)
		const responseRegex = new RegExp(`<${NS_PREFIX}response>([\\s\\S]*?)<\\/${NS_PREFIX}response>`, 'g');
		let match: RegExpExecArray | null;
		let blocksFound = 0;
		let blocksParsed = 0;

		while ((match = responseRegex.exec(xml)) !== null) {
			blocksFound++;
			const block = match[1]!;
			const entry = parseResponseBlock(block, remotePrefix);
			if (entry) {
				entries.push(entry);
				blocksParsed++;
			}
		}

		if (blocksFound > 0 && blocksParsed === 0) {
			console.warn(`[WebDAV Sync] Found ${blocksFound} response blocks but parsed 0 — namespace/href mismatch?`);
		}
	} catch (err) {
		console.error('Failed to parse PROPFIND XML:', err);
	}

	// Filter out the root path itself (we only want children)
	const filtered = entries.filter(e => {
		const norm = e.path.replace(/^\/+|\/+$/g, '');
		return norm !== remotePrefix && norm.length > 0;
	});
	return {
		entries: filtered,
		baseHref,
	};
}

/**
 * Parse a single response block.
 */
function parseResponseBlock(block: string, remotePrefix: string): WebDAVFileInfo | null {
	// Extract href with any namespace prefix
	const hrefRegex = new RegExp(`<${NS_PREFIX}href>([^<]*)<\\/${NS_PREFIX}href>`);
	const hrefMatch = block.match(hrefRegex);
	if (!hrefMatch || !hrefMatch[1]) return null;

	let href = decodeURIComponent(hrefMatch[1].trim());
	// Remove trailing slash for directory comparison
	const isDirectory = href.endsWith('/');
	href = href.replace(/\/+$/, '');

	// Normalize path: strip the remote prefix to get vault-relative path
	let vaultPath = href;
	if (remotePrefix && href.startsWith('/' + remotePrefix)) {
		vaultPath = href.slice(remotePrefix.length + 1);
	} else if (remotePrefix && href.startsWith(remotePrefix)) {
		vaultPath = href.slice(remotePrefix.length);
	}
	vaultPath = vaultPath.replace(/^\/+/, '');

	// Extract properties
	const etag = cleanEtag(extractPropValue(block, 'getetag'));
	const lastModified = extractPropValue(block, 'getlastmodified');
	const sizeStr = extractPropValue(block, 'getcontentlength');
	const size = parseInt(sizeStr || '0', 10) || 0;
	const contentType = extractPropValue(block, 'getcontenttype');

	// Determine if this is a directory.
	// Method 1: href ends with trailing slash.
	// Method 2: <resourcetype> contains <collection/> (with any namespace prefix).
	// extractPropValue can't capture nested XML, so search the raw block for /collection>.
	const hasCollection = /<(?:\w+:)?collection\s*\/>/i.test(block)
		|| /<(?:\w+:)?collection>\s*<\/(?:\w+:)?collection>/i.test(block);
	const isColl = isDirectory || hasCollection;

	return {
		path: vaultPath,
		isDirectory: isColl,
		etag,
		lastModified,
		size,
		contentType,
	};
}

/**
 * Extract a property value from a response block.
 * Matches with any namespace prefix (d:, D:, DAV:, ns0:, etc.) or unprefixed.
 */
function extractPropValue(block: string, propName: string): string {
	const tagRegex = new RegExp(`<${NS_PREFIX}${propName}[^>]*>([^<]*)<\\/${NS_PREFIX}${propName}>`, 'i');
	const match = block.match(tagRegex);
	return match?.[1]?.trim() ?? '';
}

/**
 * Strip surrounding quotes from ETag and normalize.
 */
function cleanEtag(etag: string): string {
	return etag.replace(/^["']|["']$/g, '');
}

/**
 * Build a PROPFIND request body XML string.
 * Requests the properties we need: ETag, last modified, size, type.
 */
export function buildPropfindBody(): string {
	return `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <getetag/>
    <getlastmodified/>
    <getcontentlength/>
    <getcontenttype/>
    <resourcetype/>
  </prop>
</propfind>`;
}
