import { decode } from 'blurhash';
import { useEffect, useRef } from 'react';

/** Paint a blurhash into a canvas — the bloom under a loading photo. */
export function BlurhashCanvas({
	hash,
	width = 32,
	height = 32,
	className,
}: {
	hash: string;
	width?: number;
	height?: number;
	className?: string;
}) {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = ref.current;
		if (!canvas || !hash) return;
		try {
			const pixels = decode(hash, width, height);
			const context = canvas.getContext('2d');
			if (!context) return;
			const imageData = context.createImageData(width, height);
			imageData.data.set(pixels);
			context.putImageData(imageData, 0, 0);
		} catch {
			// a bad hash just means no bloom
		}
	}, [hash, width, height]);

	return <canvas ref={ref} width={width} height={height} className={className} aria-hidden />;
}
