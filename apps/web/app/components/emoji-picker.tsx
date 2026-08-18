import { useState } from 'react';
import { cn } from '~/lib/cn';

export const SPACE_EMOJIS = [
	'🌷',
	'🫶',
	'🌈',
	'🐣',
	'🍓',
	'🌙',
	'🐸',
	'🧸',
	'🍊',
	'🌊',
	'🪩',
	'🎈',
	'🍰',
	'🌻',
	'🦋',
	'🫧',
	'🍄',
	'⛺',
	'🎨',
	'📚',
	'🎶',
	'☕',
	'🥐',
	'🏔️',
];

/** Emoji radio-grid that submits through a hidden input. */
export function EmojiPicker({
	name = 'emoji',
	defaultValue = '🌷',
}: {
	name?: string;
	defaultValue?: string;
}) {
	const [selected, setSelected] = useState(defaultValue);

	return (
		<div>
			<input type="hidden" name={name} value={selected} />
			<div className="grid grid-cols-8 gap-1">
				{SPACE_EMOJIS.map((emoji) => (
					<button
						key={emoji}
						type="button"
						aria-pressed={selected === emoji}
						onClick={() => setSelected(emoji)}
						className={cn(
							'flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-paper-deep',
							selected === emoji && 'bg-accent-soft ring-2 ring-accent',
						)}
					>
						{emoji}
					</button>
				))}
			</div>
		</div>
	);
}
