import { convertToPng, detectSupportedImageMimeTypeFromFile, formatDimensionNote, resizeImage } from "@earendil-works/pi-coding-agent";

/** A model-visible content block, matching the shape pi tools return from `execute`. */
export type ContentBlock =
	| { type: "text"; text: string }
	| { type: "image"; data: string; mimeType: string };

/** A value whose model-visible form is ordered content rather than one text string. */
export interface ContentValue {
	content(): ContentBlock[] | Promise<ContentBlock[]>;
}

const INLINE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function baseMimeType(mimeType: string): string {
	return mimeType.split(";")[0]?.trim().toLowerCase() ?? mimeType.toLowerCase();
}

function startsWith(bytes: Uint8Array, at: number, values: readonly number[]): boolean {
	return bytes.length >= at + values.length && values.every((value, index) => bytes[at + index] === value);
}

function startsWithAscii(bytes: Uint8Array, at: number, text: string): boolean {
	return bytes.length >= at + text.length && [...text].every((character, index) => bytes[at + index] === character.charCodeAt(0));
}

/**
 * Cheap prefix sniff used to route a read to the authoritative image detector.
 * False positives are harmless: they only cost one extra file open.
 */
export function looksLikeImageFile(bytes: Uint8Array): boolean {
	return startsWith(bytes, 0, [0xff, 0xd8, 0xff])
		|| startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
		|| startsWithAscii(bytes, 0, "GIF")
		|| (startsWithAscii(bytes, 0, "RIFF") && startsWithAscii(bytes, 8, "WEBP"))
		|| (startsWithAscii(bytes, 0, "BM") && bytes.length >= 26);
}

/** pi's detector: PNG/JPEG/GIF/WebP/BMP, rejecting animated PNG and unrecognized containers. */
export async function detectImageMimeType(path: string): Promise<string | null> {
	return (await detectSupportedImageMimeTypeFromFile(path)) ?? null;
}

/**
 * A read image, ready for a tool result: pi-normalized, resized to the inline
 * provider limits, and rendered as a note. The base64 payload is private, so
 * ordinary object inspection does not expose it. content() deliberately emits
 * the payload for show() and completion notifications.
 */
export class ImageFile implements ContentValue {
	#data: string;
	readonly path: string;
	readonly mimeType: string;
	readonly width: number;
	readonly height: number;
	/** Textual description of the image, shown when the value is rendered as text. */
	readonly note: string;
	constructor(path: string, mimeType: string, data: string, note: string, width: number, height: number) {
		this.path = path;
		this.mimeType = mimeType;
		this.#data = data;
		this.note = note;
		this.width = width;
		this.height = height;
	}
	render(): string { return this.note; }
	content(): ContentBlock[] {
		return [{ type: "text", text: this.note }, { type: "image", data: this.#data, mimeType: this.mimeType }];
	}
}

/**
 * Convert and resize image bytes the way pi's `read` tool does, then wrap them
 * in a value that renders textually but carries the image in its content.
 * Throws instead of returning a partial value so a failed read is explicit.
 */
export async function createImageFile(path: string, bytes: Uint8Array, detectedMimeType: string): Promise<ImageFile> {
	const hints: string[] = [];
	const from = baseMimeType(detectedMimeType);
	let mimeType = from;
	let content: Uint8Array = bytes;
	if (!INLINE_MIME_TYPES.has(from)) {
		const converted = await convertToPng(Buffer.from(bytes).toString("base64"), from);
		if (!converted) throw new Error(`${path}: unsupported image format ${from} (cannot convert it to an inline image)`);
		mimeType = converted.mimeType;
		content = Buffer.from(converted.data, "base64");
		hints.push(`[Image converted from ${from} to ${mimeType}.]`);
	}
	const resized = await resizeImage(content, mimeType);
	if (!resized) throw new Error(`${path}: image omitted: could not be resized below the inline image size limit`);
	const dimension = formatDimensionNote(resized);
	if (dimension) hints.push(dimension);
	const note = [`${path} [${resized.mimeType}]`, ...hints].join("\n");
	return new ImageFile(path, resized.mimeType, resized.data, note, resized.width, resized.height);
}
