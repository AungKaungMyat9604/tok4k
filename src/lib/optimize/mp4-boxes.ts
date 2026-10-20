/**
 * Minimal MP4 box helpers for container normalize + sample-table density inflate.
 * Technique is the publicly documented frame-density approach used by open tools
 * such as MIT-licensed tiktok-quality (no re-encode of media samples).
 */

export type Mp4Box = {
	offset: number;
	size: number;
	type: string;
	end: number;
	is64Bit: boolean;
};

export function parseBoxes(
	bytes: Uint8Array,
	view: DataView,
	startOffset: number,
	endOffset: number
): Mp4Box[] {
	const boxes: Mp4Box[] = [];
	let offset = startOffset;
	while (offset + 8 <= endOffset) {
		const rawSize = view.getUint32(offset, false);
		let size: number;
		let is64Bit = false;

		if (rawSize === 0) {
			size = endOffset - offset;
		} else if (rawSize === 1) {
			is64Bit = true;
			if (offset + 16 > endOffset) break;
			const hi = view.getUint32(offset + 8, false);
			const lo = view.getUint32(offset + 12, false);
			const sizeBig = (BigInt(hi) << 32n) + BigInt(lo);
			if (sizeBig > BigInt(Number.MAX_SAFE_INTEGER)) break;
			size = Number(sizeBig);
		} else {
			size = rawSize;
		}

		if (size < 8 || offset + size > endOffset) break;

		const type = String.fromCharCode(
			bytes[offset + 4],
			bytes[offset + 5],
			bytes[offset + 6],
			bytes[offset + 7]
		);
		boxes.push({ offset, size, type, end: offset + size, is64Bit });
		offset += size;
	}
	return boxes;
}

export function getBoxHeaderSize(box: Mp4Box): number {
	return box.is64Bit ? 16 : 8;
}

const HANDLER_VIDEO = [0x76, 0x69, 0x64, 0x65]; // vide

function bytesEqualAt(bytes: Uint8Array, offset: number, pattern: number[]): boolean {
	for (let i = 0; i < pattern.length; i++) {
		if (bytes[offset + i] !== pattern[i]) return false;
	}
	return true;
}

export function findHandlerType(bytes: Uint8Array, hdlrBox: Mp4Box): string | null {
	const start = hdlrBox.offset + getBoxHeaderSize(hdlrBox);
	const end = hdlrBox.end;
	for (let i = start; i + 4 <= end; i++) {
		if (bytesEqualAt(bytes, i, HANDLER_VIDEO)) return 'vide';
	}
	return null;
}

export function detectCodecFromStbl(bytes: Uint8Array, stblBox: Mp4Box): string {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const children = parseBoxes(
		bytes,
		view,
		stblBox.offset + getBoxHeaderSize(stblBox),
		stblBox.end
	);
	const stsdBox = children.find((b) => b.type === 'stsd');
	if (!stsdBox) return 'unknown';
	const contentStart = stsdBox.offset + getBoxHeaderSize(stsdBox);
	if (contentStart + 16 > stsdBox.end) return 'unknown';
	return String.fromCharCode(
		bytes[contentStart + 12],
		bytes[contentStart + 13],
		bytes[contentStart + 14],
		bytes[contentStart + 15]
	);
}

export function detectVideoCodecFromMoov(
	bytes: Uint8Array,
	view: DataView,
	moovBox: Mp4Box
): string {
	const moovChildren = parseBoxes(
		bytes,
		view,
		moovBox.offset + getBoxHeaderSize(moovBox),
		moovBox.end
	);

	for (const trak of moovChildren.filter((b) => b.type === 'trak')) {
		const trakChildren = parseBoxes(
			bytes,
			view,
			trak.offset + getBoxHeaderSize(trak),
			trak.end
		);
		const mdiaBox = trakChildren.find((b) => b.type === 'mdia');
		if (!mdiaBox) continue;

		const mdiaChildren = parseBoxes(
			bytes,
			view,
			mdiaBox.offset + getBoxHeaderSize(mdiaBox),
			mdiaBox.end
		);
		const minfBox = mdiaChildren.find((b) => b.type === 'minf');
		if (!minfBox) continue;

		const minfChildren = parseBoxes(
			bytes,
			view,
			minfBox.offset + getBoxHeaderSize(minfBox),
			minfBox.end
		);
		const stblBox = minfChildren.find((b) => b.type === 'stbl');
		if (!stblBox) continue;

		return detectCodecFromStbl(bytes, stblBox);
	}

	return 'unknown';
}

export function updateBoxSize(view: DataView, offset: number, box: Mp4Box, addedBytes: number) {
	if (box.is64Bit) {
		view.setBigUint64(offset + 8, BigInt(box.size + addedBytes), false);
	} else {
		view.setUint32(offset, box.size + addedBytes, false);
	}
}

export function updateChunkOffsets(
	newBytes: Uint8Array,
	newView: DataView,
	boxStart: number,
	boxEnd: number,
	delta: number
) {
	const containerTypes = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
	for (const box of parseBoxes(newBytes, newView, boxStart, boxEnd)) {
		if (box.type === 'stco') {
			const headerSize = getBoxHeaderSize(box);
			const count = newView.getUint32(box.offset + headerSize + 4, false);
			for (let i = 0; i < count; i++) {
				const pos = box.offset + headerSize + 8 + i * 4;
				newView.setUint32(pos, newView.getUint32(pos, false) + delta, false);
			}
		} else if (box.type === 'co64') {
			const headerSize = getBoxHeaderSize(box);
			const count = newView.getUint32(box.offset + headerSize + 4, false);
			for (let i = 0; i < count; i++) {
				const pos = box.offset + headerSize + 8 + i * 8;
				newView.setBigUint64(
					pos,
					newView.getBigUint64(pos, false) + BigInt(delta),
					false
				);
			}
		} else if (containerTypes.has(box.type)) {
			updateChunkOffsets(
				newBytes,
				newView,
				box.offset + getBoxHeaderSize(box),
				box.end,
				delta
			);
		}
	}
}
