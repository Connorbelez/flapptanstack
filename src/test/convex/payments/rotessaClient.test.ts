import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createRotessaClient,
	getRotessaClient,
	resetRotessaClient,
	RotessaConfigError,
} from "../../../../convex/payments/rotessa/client";

afterEach(() => {
	resetRotessaClient();
	vi.unstubAllEnvs();
});

describe("getRotessaClient", () => {
	it("reuses the singleton when no overrides are provided", () => {
		vi.stubEnv("ROTESSA_API_KEY", "test-rotessa-key");

		const client = getRotessaClient();

		expect(getRotessaClient()).toBe(client);
	});

	it("rejects late singleton reconfiguration", () => {
		vi.stubEnv("ROTESSA_API_KEY", "test-rotessa-key");
		const firstFetch = vi.fn();

		getRotessaClient({
			fetchFn: firstFetch as unknown as typeof fetch,
		});

		expect(() =>
			getRotessaClient({
				baseUrl: "https://sandbox.rotessa.test",
			})
		).toThrow(RotessaConfigError);
	});

	it("accepts ROTESSA_API_URL as a base-url fallback", async () => {
		vi.stubEnv("ROTESSA_API_KEY", "test-rotessa-key");
		vi.stubEnv("ROTESSA_API_URL", "https://sandbox.rotessa.test");
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => "[]",
		});

		const client = createRotessaClient({
			fetchFn: fetchMock as unknown as typeof fetch,
		});
		await client.customers.list();

		expect(fetchMock).toHaveBeenCalledWith(
			"https://sandbox.rotessa.test/customers",
			expect.objectContaining({ method: "GET" })
		);
	});
});
