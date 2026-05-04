import { useState } from "react";

export function SanityCounter() {
	const [n] = useState(0);
	return <div>{n}</div>;
}
