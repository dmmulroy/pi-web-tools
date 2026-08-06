# Pi Web Tools

A [Pi](https://pi.dev) package that adds tools for fetching and searching the public web.

- `webfetch` fetches one public URL as Markdown, text, raw HTML, or an inline raster image.
- `websearch` searches the public web through an Exa MCP-compatible endpoint.

## Install

Configure an Exa MCP-compatible endpoint, then install globally from GitHub:

```bash
export PI_WEB_TOOLS_EXA_ENDPOINT="https://your-exa-endpoint.example/mcp"
pi install git:github.com/dmmulroy/pi-web-tools
```

Try it for one Pi invocation without installing:

```bash
pi -e git:github.com/dmmulroy/pi-web-tools
```

Pi packages execute with your full system permissions. Review package source before installation.

## Tools

### `webfetch`

Parameters:

- `url` — required HTTP or HTTPS URL
- `format` — optional: `markdown`, `text`, or `html`
- `timeout` — optional timeout in seconds, clamped to `1..120`

Defaults and behavior:

- returns Markdown by default
- blocks private and local hosts and IP addresses
- follows at most five redirects
- rejects URL credentials and unsupported binary content
- returns PNG, JPEG, GIF, and WebP images inline
- limits responses to 5 MB
- retries Cloudflare challenge responses with a browser-like fallback user agent

### `websearch`

Parameters:

- `query` — required search query
- `maxResults` — optional result count, clamped to `1..20`
- `depth` — optional: `auto`, `fast`, or `deep`; `deep` is accepted as a compatibility alias for `fast`

Defaults and behavior:

- returns up to eight results
- uses the Exa provider through `PI_WEB_TOOLS_EXA_ENDPOINT`
- limits provider responses to 1 MB
- truncates large tool output and saves the complete output to a temporary file

## Configuration

`websearch` requires `PI_WEB_TOOLS_EXA_ENDPOINT` to contain a public HTTP or HTTPS URL for an Exa MCP-compatible endpoint. Add it to your shell environment before starting Pi:

```bash
export PI_WEB_TOOLS_EXA_ENDPOINT="https://your-exa-endpoint.example/mcp"
```

`webfetch` does not require this variable. Per-call arguments can override `webfetch.format`, `webfetch.timeout`, `websearch.maxResults`, and `websearch.depth`.

## Development

Requires Node.js 22.19 or newer.

```bash
npm install
npm run check
```

## License

[MIT](./LICENSE)
