import test from "node:test";
import assert from "node:assert/strict";
import { initTheme } from "@earendil-works/pi-coding-agent";
import { parsePublicHttpUrl } from "../types.ts";
import { createWebSearchTool, formatSearchResults } from "../websearch.ts";

initTheme(undefined, false);

const renderTheme = {
	fg: (_name: string, value: string) => value,
	bold: (value: string) => value,
};

test("websearch renderResult prefers host key hints for collapsed results", () => {
	const tool = createWebSearchTool();
	const calls: Array<[string, string]> = [];
	const result = { content: [{ type: "text", text: "Search content" }] };

	const collapsed = tool.renderResult(result, { expanded: false, isPartial: false }, renderTheme, {
		keyHint(keybinding, description) {
			calls.push([keybinding, description]);
			return "HOST ctrl+o for details";
		},
	});
	assert.match(collapsed.render(200).join("\n"), /✓ 0 results HOST ctrl\+o for details/);
	assert.deepEqual(calls, [["app.tools.expand", "for details"]]);

	const fallback = tool.renderResult(result, { expanded: false, isPartial: false }, renderTheme);
	assert.match(fallback.render(200).join("\n"), /✓ 0 results/);

	const expanded = tool.renderResult(result, { expanded: true, isPartial: false }, renderTheme, {
		keyHint() {
			assert.fail("expanded results must not request a key hint");
		},
	});
	assert.match(expanded.render(200).join("\n"), /Search content/);
});

test("formatSearchResults renders deterministic URL-forward output", () => {
	const url = parsePublicHttpUrl("https://example.com/");
	assert.equal(url._tag, "ok");

	const output = formatSearchResults("example query", [
		{
			title: "Example Domain",
			url: url.value,
			snippet: "Documentation-safe example domain.",
		},
	]);
	assert.equal(
		output,
		[
			"Search results for: example query",
			"",
			"1. Example Domain",
			"   URL: https://example.com/",
			"   Snippet: Documentation-safe example domain.",
		].join("\n"),
	);
});
