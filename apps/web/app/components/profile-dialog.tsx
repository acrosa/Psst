import { useRef, useState } from 'react';
import { useRevalidator } from 'react-router';
import { CameraIcon } from '~/components/icons';
import { Avatar } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Dialog } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

/** A small profile sheet: your face and your name, nothing else. */
export function ProfileDialog({
	open,
	onClose,
	name,
	image,
}: {
	open: boolean;
	onClose: () => void;
	name: string | null;
	image?: string | null;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const revalidator = useRevalidator();

	async function save(formData: FormData) {
		setSaving(true);
		setError(null);
		try {
			if (file) formData.set('file', file);
			const response = await fetch('/api/profile', { method: 'POST', body: formData });
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				setError(body?.error ?? 'That didn’t save — try again?');
				return;
			}
			revalidator.revalidate();
			onClose();
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onClose={onClose} title="Your profile">
			<form
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					void save(new FormData(event.currentTarget));
				}}
			>
				{error ? <p className="text-accent-deep text-sm">{error}</p> : null}

				<div className="flex items-center gap-4">
					{preview ? (
						<img src={preview} alt="" className="h-14 w-14 rounded-full object-cover" />
					) : (
						<Avatar name={name} image={image} className="!h-14 !w-14 text-xl" />
					)}
					<Button type="button" variant="soft" size="sm" onClick={() => fileRef.current?.click()}>
						<CameraIcon className="mr-1.5 h-4 w-4" />
						Change photo
					</Button>
					<input
						ref={fileRef}
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
						aria-label="Profile photo"
						className="hidden"
						onChange={(event) => {
							const picked = event.currentTarget.files?.[0] ?? null;
							setFile(picked);
							setPreview(picked ? URL.createObjectURL(picked) : null);
						}}
					/>
				</div>

				<div className="grid gap-1.5">
					<Label htmlFor="profile-name">Name</Label>
					<Input
						id="profile-name"
						name="name"
						defaultValue={name ?? ''}
						maxLength={60}
						autoComplete="name"
						required
					/>
				</div>

				<div className="flex justify-end gap-2">
					<Button type="button" variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? 'Saving…' : 'Save'}
					</Button>
				</div>
			</form>
		</Dialog>
	);
}
