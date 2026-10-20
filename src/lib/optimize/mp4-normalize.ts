import {
	detectVideoCodecFromMoov,
	getBoxHeaderSize,
	parseBoxes,
	updateChunkOffsets,
	type Mp4Box
} from './mp4-boxes';

function buildFtyp(isHevc: boolean): Uint8Array {
	if (isHevc) {
		const ftyp = new Uint8Array(32);
		const v = new DataView(ftyp.buffer);
		v.setUint32(0, 32, false);
		ftyp.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
		ftyp.set([0x69, 0x73, 0x6f, 0x34], 8); // iso4
		v.setUint32(12, 0x00000200, false);
		ftyp.set([0x69, 0x73, 0x6f, 0x6d], 16); // isom
		ftyp.set([0x69, 0x73, 0x6f, 0x32], 20); // iso2
		ftyp.set([0x68, 0x76, 0x63, 0x31], 24); // hvc1
		ftyp.set([0x6d, 0x70, 0x34, 0x31], 28); // mp41
		return ftyp;
	}
	const ftyp = new Uint8Array(28);
	const v = new DataView(ftyp.buffer);
	v.setUint32(0, 28, false);
	ftyp.set([0x66, 0x74, 0x79, 0x70], 4);
	ftyp.set([0x69, 0x73, 0x6f, 0x6d], 8); // isom
	ftyp.set([0x00, 0x00, 0x02, 0x00], 12);
	ftyp.set([0x69, 0x73, 0x6f, 0x6d], 16);
	ftyp.set([0x69, 0x73, 0x6f, 0x32], 20);
	ftyp.set([0x6d, 0x70, 0x34, 0x31], 24);
	return ftyp;
}

export type NormalizeResult = {
	bytes: Uint8Array;
	view: DataView;
	changed: boolean;
	valid: boolean;
};

/** Fast-start layout: ftyp (isom) + moov + mdat. */
export function normalizeContainer(inputBytes: Uint8Array, inputView: DataView): NormalizeResult {
	const fileSize = inputBytes.length;
	const topBoxes = parseBoxes(inputBytes, inputView, 0, fileSize);

	const ftypBox = topBoxes.find((b) => b.type === 'ftyp');
	const moovBox = topBoxes.find((b) => b.type === 'moov');
	const mdatBox = topBoxes.find((b) => b.type === 'mdat');

	if (!moovBox) {
		return { bytes: inputBytes, view: inputView, changed: false, valid: false };
	}

	if (!mdatBox) {
		return { bytes: inputBytes, view: inputView, changed: false, valid: true };
	}

	const moovBeforeMdat = moovBox.offset < mdatBox.offset;
	let needsFtypRewrite = false;
	let ftypBytes: Uint8Array | null = null;

	if (ftypBox) {
		const brandOffset = ftypBox.offset + getBoxHeaderSize(ftypBox);
		const majorBrand = String.fromCharCode(
			inputBytes[brandOffset],
			inputBytes[brandOffset + 1],
			inputBytes[brandOffset + 2],
			inputBytes[brandOffset + 3]
		);
		if (majorBrand !== 'isom') {
			needsFtypRewrite = true;
			const codec = detectVideoCodecFromMoov(inputBytes, inputView, moovBox);
			const isHevc = codec === 'hvc1' || codec === 'hev1';
			ftypBytes = buildFtyp(isHevc);
		}
	} else {
		needsFtypRewrite = true;
		const codec = detectVideoCodecFromMoov(inputBytes, inputView, moovBox);
		ftypBytes = buildFtyp(codec === 'hvc1' || codec === 'hev1');
	}

	if (moovBeforeMdat && !needsFtypRewrite) {
		return { bytes: inputBytes, view: inputView, changed: false, valid: true };
	}

	const ftypSize =
		needsFtypRewrite && ftypBytes ? ftypBytes.length : ftypBox ? ftypBox.size : 0;
	const newSize = ftypSize + moovBox.size + mdatBox.size;
	const newBytes = new Uint8Array(newSize);
	const newView = new DataView(newBytes.buffer);

	let writePos = 0;

	if (needsFtypRewrite && ftypBytes) {
		newBytes.set(ftypBytes, writePos);
		writePos += ftypBytes.length;
	} else if (ftypBox) {
		newBytes.set(inputBytes.subarray(ftypBox.offset, ftypBox.end), writePos);
		writePos += ftypBox.size;
	}

	newBytes.set(inputBytes.subarray(moovBox.offset, moovBox.end), writePos);
	const newMoovOffset = writePos;
	writePos += moovBox.size;

	newBytes.set(inputBytes.subarray(mdatBox.offset, mdatBox.end), writePos);

	const newMdatOffset = newMoovOffset + moovBox.size;
	const chunkOffsetDelta = newMdatOffset - mdatBox.offset;

	if (chunkOffsetDelta !== 0) {
		const headerStub: Mp4Box = {
			offset: newMoovOffset,
			size: moovBox.size,
			type: 'moov',
			end: newMoovOffset + moovBox.size,
			is64Bit: moovBox.is64Bit
		};
		updateChunkOffsets(
			newBytes,
			newView,
			newMoovOffset + getBoxHeaderSize(headerStub),
			newMoovOffset + moovBox.size,
			chunkOffsetDelta
		);
	}

	return { bytes: newBytes, view: newView, changed: true, valid: true };
}
