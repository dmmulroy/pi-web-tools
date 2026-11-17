import test from "node:test";
import assert from "node:assert/strict";
import { FetchHttpTextClient, SEARCH_USER_AGENT } from "../providers/exa.ts";
import { parsePublicHttpUrl } from "../types.ts";

// Regression: inside the pi CLI, global fetch is npm undici, whose default
// `User-Agent: undici` is hard-blocked (HTTP 429) by Parallel's free tier.
// The client must always send its own User-Agent.
test("FetchHttpTextClient sends an explicit pi-web-tools User-Agent", async () => {
	const originalFetch = globalThis.fetch;
	let sentHeaders: Headers | undefined;
	globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
		sentHeaders = new Headers(init?.headers);
		return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
	}) as typeof fetch;
	try {
		const url = parsePublicHttpUrl("https://example.test/mcp");
		assert.equal(url._tag, "ok");
		const client = new FetchHttpTextClient();
		const result = await client.postJson({
			url: url.value,
			headers: { "content-type": "application/json" },
			body: {},
			maxResponseBytes: 1024,
		});
		assert.equal(result._tag, "ok");
		assert.equal(sentHeaders?.get("user-agent"), SEARCH_USER_AGENT);
		assert.match(SEARCH_USER_AGENT, /^pi-web-tools\b/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
