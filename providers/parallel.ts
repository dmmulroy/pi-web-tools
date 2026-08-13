import { err, ok, type Result } from "../result.ts";
import { parsePublicHttpUrl } from "../types.ts";
import type { NormalizedSearchResult, SearchProvider, SearchProviderError, SearchProviderRequest } from "./types.ts";
import {
	MAX_SEARCH_RESPONSE_BYTES,
	type HttpClientError,
	type HttpTextClient,
} from "./exa.ts";

interface ParallelSearchResultDto {
	readonly url: string;
	readonly title?: string | null;
	readonly publish_date?: string | null;
	readonly excerpts: readonly string[];
}

/** Search Parallel through its MCP endpoint and normalize its structured results. */
export class ParallelSearchProvider implements SearchProvider {
	readonly name = "parallel" as const;

	constructor(
		private readonly endpoint: import("../types.ts").PublicHttpUrl,
		private readonly http: HttpTextClient,
	) {}

	async search(
		input: SearchProviderRequest,
		options: { readonly signal?: AbortSignal } = {},
	): Promise<Result<readonly NormalizedSearchResult[], SearchProviderError>> {
		const response = await this.http.postJson(
			{
				url: this.endpoint,
				headers: {
					accept: "application/json, text/event-stream",
					"content-type": "application/json",
				},
				body: {
					jsonrpc: "2.0",
					id: 1,
					method: "tools/call",
					params: {
						name: "web_search",
						arguments: {
							objective: input.query,
							search_queries: [input.query],
						},
					},
				},
				maxResponseBytes: MAX_SEARCH_RESPONSE_BYTES,
			},
			{ signal: options.signal },
		);

		if (response._tag === "err") return err(mapHttpClientError(response.error));
		if (response.value.status < 200 || response.value.status >= 300) {
			return err({ _tag: "SearchProviderStatusRejected", provider: this.name, status: response.value.status });
		}

		const parsed = parseParallelResponse(response.value.bodyText);
		if (parsed._tag === "err") {
			return err({ _tag: "SearchProviderProtocolInvalid", provider: this.name, reason: parsed.error });
		}
		return ok(parsed.value.slice(0, input.maxResults));
	}
}

function parseParallelResponse(body: string): Result<readonly NormalizedSearchResult[], string> {
	let envelope: unknown;
	try {
		envelope = JSON.parse(body);
	} catch {
		return err("Invalid JSON payload");
	}
	if (!isRecord(envelope)) return err("Expected an object payload");
	if (isRecord(envelope["error"])) return err("MCP error response");

	const result = envelope["result"];
	if (!isRecord(result)) return err("Missing result object");
	if (result["isError"] === true) return err("Search provider returned an error");

	let payload: unknown = result["structuredContent"];
	if (!isRecord(payload)) {
		const content = result["content"];
		const text = Array.isArray(content)
			? content.find((item) => isRecord(item) && item["type"] === "text" && typeof item["text"] === "string")?.["text"]
			: undefined;
		if (typeof text !== "string") return err("Missing structured search results");
		try {
			payload = JSON.parse(text);
		} catch {
			return err("Invalid structured search results");
		}
	}
	if (!isRecord(payload) || !Array.isArray(payload["results"])) return err("Missing results array");

	const results: NormalizedSearchResult[] = [];
	for (const item of payload["results"]) {
		if (!isParallelResult(item)) continue;
		const url = parsePublicHttpUrl(item.url);
		if (url._tag === "err") continue;
		results.push({
			title: item.title?.trim() || url.value,
			url: url.value,
			snippet: item.excerpts.join("\n\n").trim() || undefined,
			publishedAt: item.publish_date?.trim() || undefined,
			source: "Parallel",
		});
	}
	return ok(results);
}

function mapHttpClientError(error: HttpClientError): SearchProviderError {
	switch (error._tag) {
		case "HttpRequestFailed":
			return { _tag: "SearchProviderUnavailable", provider: "parallel", cause: error.cause };
		case "HttpResponseTooLarge":
			return { _tag: "SearchProviderResponseTooLarge", provider: "parallel", maxBytes: error.maxBytes };
		case "HttpCancelled":
			return { _tag: "SearchProviderCancelled", provider: "parallel", cause: error.cause };
	}
}

function isParallelResult(value: unknown): value is ParallelSearchResultDto {
	return isRecord(value) && typeof value["url"] === "string" && Array.isArray(value["excerpts"])
		&& value["excerpts"].every((excerpt) => typeof excerpt === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
