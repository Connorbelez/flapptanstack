const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidMicAccessEmail(raw: string): boolean {
	return EMAIL_REGEX.test(raw.trim());
}
