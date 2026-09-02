import { useEffect, useRef, useState } from 'react';
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
	const [emailMentions, setEmailMentions] = useState(true);
	const [changingPassword, setChangingPassword] = useState(false);
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [passwordSaved, setPasswordSaved] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);
	const revalidator = useRevalidator();

	async function savePassword(form: HTMLFormElement) {
		setSavingPassword(true);
		setPasswordError(null);
		try {
			const body = new FormData(form);
			body.set('intent', 'change-password');
			const response = await fetch('/api/profile', { method: 'POST', body });
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				setPasswordError(data?.error ?? 'That didn’t save — try again?');
				return;
			}
			form.reset();
			setChangingPassword(false);
			setPasswordSaved(true);
			setTimeout(() => setPasswordSaved(false), 3000);
		} finally {
			setSavingPassword(false);
		}
	}

	useEffect(() => {
		if (!open) return;
		fetch('/api/profile')
			.then((response) => response.json())
			.then((data) => setEmailMentions(data.emailMentions ?? true))
			.catch(() => {});
	}, [open]);

	async function save(formData: FormData) {
		setSaving(true);
		setError(null);
		try {
			if (file) formData.set('file', file);
			formData.set('emailMentions', emailMentions ? 'true' : 'false');
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

				{changingPassword ? null : (
					<button
						type="button"
						onClick={() => setChangingPassword(true)}
						className="justify-self-start text-ink-faint text-sm underline underline-offset-2 transition hover:text-ink-soft"
					>
						{passwordSaved ? 'Password saved ✓' : 'Change password'}
					</button>
				)}

				<label className="flex cursor-pointer items-center gap-2.5 text-ink-soft text-sm">
					<input
						type="checkbox"
						checked={emailMentions}
						onChange={(event) => setEmailMentions(event.currentTarget.checked)}
						className="h-4 w-4 accent-[var(--color-accent)]"
					/>
					Email me when someone mentions me
				</label>

				<div className="flex justify-end gap-2">
					<Button type="button" variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? 'Saving…' : 'Save'}
					</Button>
				</div>
			</form>

			{changingPassword ? (
				<form
					className="mt-5 grid gap-3 border-line border-t pt-5"
					onSubmit={(event) => {
						event.preventDefault();
						void savePassword(event.currentTarget);
					}}
				>
					{passwordError ? <p className="text-accent-deep text-sm">{passwordError}</p> : null}

					<div className="grid gap-1.5">
						<Label htmlFor="current-password">Current password</Label>
						<Input
							id="current-password"
							name="currentPassword"
							type="password"
							autoComplete="current-password"
							required
						/>
					</div>

					<div className="grid gap-1.5">
						<Label htmlFor="new-password">New password</Label>
						<Input
							id="new-password"
							name="newPassword"
							type="password"
							autoComplete="new-password"
							placeholder="8+ characters"
							minLength={8}
							required
						/>
					</div>

					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								setChangingPassword(false);
								setPasswordError(null);
							}}
						>
							Never mind
						</Button>
						<Button type="submit" disabled={savingPassword}>
							{savingPassword ? 'Saving…' : 'Save password'}
						</Button>
					</div>
				</form>
			) : null}
		</Dialog>
	);
}
