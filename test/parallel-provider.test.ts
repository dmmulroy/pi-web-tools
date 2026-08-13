import test from "node:test";
import assert from "node:assert/strict";
import { ok, type Result } from "../result.ts";
import { ParallelSearchProvider } from "../providers/parallel.ts";
import type { HttpClientError, HttpJsonRequest, HttpTextClient, HttpTextResponse } from "../providers/exa.ts";
import { parsePublicHttpUrl, parseSearchQuery } from "../types.ts";

class RecordingHttpTextClient implements HttpTextClient {
	readonly requests: HttpJsonRequest[] = [];

	constructor(private readonly response: Result<HttpTextResponse, HttpClientError>) {}

	async postJson(request: HttpJsonRequest): Promise<Result<HttpTextResponse, HttpClientError>> {
		this.requests.push(request);
		return this.response;
	}
}

test("ParallelSearchProvider sends web_search and parses structured results", async () => {
	const endpoint = parsePublicHttpUrl("https://example.test/mcp");
	const query = parseSearchQuery("official example website");
	assert.equal(endpoint._tag, "ok");
	assert.equal(query._tag, "ok");

	const payload = {
		search_id: "search_example",
		results: [{
			url: "https://example.com/",
			title: "Example Domain",
			publish_date: null,
			excerpts: ["Example excerpt."],
		}],
		session_id: "session_example",
	};
	const http = new RecordingHttpTextClient(ok({
		status: 200,
		statusText: "OK",
		headers: new Headers({ "content-type": "application/json" }),
		bodyText: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			result: {
				content: [{ type: "text", text: JSON.stringify(payload) }],
				structuredContent: payload,
			},
		}),
		bytes: 100,
	}));

	const provider = new ParallelSearchProvider(endpoint.value, http);
	const result = await provider.search({ query: query.value, maxResults: 5, depth: "auto" });

	assert.equal(result._tag, "ok");
	assert.equal(result.value[0]?.url, "https://example.com/");
	assert.equal(result.value[0]?.snippet, "Example excerpt.");
	assert.deepEqual(http.requests[0]?.body, {
		jsonrpc: "2.0",
		id: 1,
		method: "tools/call",
		params: {
			name: "web_search",
			arguments: {
				objective: query.value,
				search_queries: [query.value],
			},
		},
	});
});
