/**
 * Binary file detection and MIME type mapping.
 */

/** Extensions treated as binary (not text/UTF-8 safe) */
const BINARY_EXTENSIONS = new Set([
	'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico',
	'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
	'zip', 'gz', 'tar', '7z', 'rar',
	'mp3', 'mp4', 'wav', 'ogg', 'webm', 'avi', 'mov',
	'ttf', 'otf', 'woff', 'woff2',
	'exe', 'dll', 'so', 'dylib',
	'bin', 'dat',
]);

/** MIME type lookup by file extension */
const MIME_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	pdf: 'application/pdf',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	ppt: 'application/vnd.ms-powerpoint',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	zip: 'application/zip',
	gz: 'application/gzip',
	tar: 'application/x-tar',
	'7z': 'application/x-7z-compressed',
	rar: 'application/vnd.rar',
	mp3: 'audio/mpeg',
	mp4: 'video/mp4',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	webm: 'video/webm',
	avi: 'video/x-msvideo',
	mov: 'video/quicktime',
	ttf: 'font/ttf',
	otf: 'font/otf',
	woff: 'font/woff',
	woff2: 'font/woff2',
};

/** Default MIME for unrecognized binary extensions */
const DEFAULT_BINARY_MIME = 'application/octet-stream';

/**
 * Check if a file path points to a binary (non-text) file.
 */
export function isBinaryFile(filePath: string): boolean {
	const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
	return BINARY_EXTENSIONS.has(ext);
}

/**
 * Get the MIME type for a file based on its extension.
 * Returns 'text/markdown' for .md, text/plain for .txt,
 * application/octet-stream for unrecognized extensions.
 */
export function getMimeType(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase() ?? '';

	if (ext === 'md') return 'text/markdown';
	if (ext === 'txt') return 'text/plain';
	if (ext === 'json') return 'application/json';
	if (ext === 'css') return 'text/css';
	if (ext === 'js') return 'application/javascript';
	if (ext === 'ts') return 'application/typescript';
	if (ext === 'html' || ext === 'htm') return 'text/html';
	if (ext === 'xml') return 'application/xml';
	if (ext === 'yaml' || ext === 'yml') return 'application/yaml';
	if (ext === 'csv') return 'text/csv';

	return MIME_TYPES[ext] ?? DEFAULT_BINARY_MIME;
}
