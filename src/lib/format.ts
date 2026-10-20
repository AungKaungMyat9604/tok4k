export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB'];
	let n = bytes / 1024;
	let i = 0;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(sec: number | null): string {
	if (sec == null || !Number.isFinite(sec)) return '—';
	const s = Math.round(sec);
	const m = Math.floor(s / 60);
	const r = s % 60;
	return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export function formatResolution(width: number | null, height: number | null): string {
	if (width == null || height == null) return '—';
	return `${width}×${height}`;
}
