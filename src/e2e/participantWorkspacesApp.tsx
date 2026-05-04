import { createRoot } from "react-dom/client";
import { E2eParticipantWorkspacesFixture } from "./participantWorkspacesFixture";
import "../styles.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Missing #root mount point");
}

createRoot(root).render(<E2eParticipantWorkspacesFixture />);
