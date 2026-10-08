export type Fetcher = (url: string, options: RequestInit) => Promise<Response>;
type RpcResponse = { jsonrpc?: string; id?: number; result?: Record<string, unknown>; error?: unknown };

/** Bounded public discovery. Never authenticates, calls a tool, reads a resource or follows a redirect. */
export async function discoverPublicMcp(endpoint: string, reviewedTools: readonly string[], fetcher: Fetcher = fetch) {
  let session: string | null = null, protocol: string | undefined;
  const signal = AbortSignal.timeout(15_000);
  async function call(method: string, id?: number, params?: unknown): Promise<RpcResponse | null> {
    const response = await fetcher(endpoint, {
      method: "POST", redirect: "error", signal,
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(session ? { "Mcp-Session-Id": session } : {}), ...(protocol ? { "MCP-Protocol-Version": protocol } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, ...(params === undefined ? {} : { params }) }),
    });
    if (!response.ok) throw new Error("MCP discovery is unavailable");
    session = response.headers.get("mcp-session-id") ?? session;
    if (id === undefined) { await response.body?.cancel(); return null; }
    if (response.status === 202 || response.status === 204) throw new Error("MCP response is missing");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("MCP response is missing");
    const decoder = new TextDecoder();
    const streaming = response.headers.get("content-type")?.includes("text/event-stream");
    let buffer = "", length = 0;
    const checked = (value: unknown): RpcResponse => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed MCP response");
      const rpc = value as RpcResponse;
      // Some reviewed servers omit the JSON-RPC envelope. If present, it must match.
      if (rpc.jsonrpc !== undefined && rpc.jsonrpc !== "2.0" || rpc.id !== undefined && rpc.id !== id || rpc.error || !rpc.result || typeof rpc.result !== "object" || Array.isArray(rpc.result)) throw new Error("Malformed MCP response");
      return rpc;
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (streaming) buffer += "\n\n";
          else return checked(JSON.parse(buffer));
        } else {
          length += value.byteLength;
          if (length > 1_048_576) throw new Error("Oversized MCP discovery response");
          buffer += decoder.decode(value, { stream: true });
        }
        // Recognize SSE even when an older fixture/server omits content-type.
        if (streaming || /^(?:event:|data:|:|id:)/.test(buffer)) {
          let boundary: RegExpExecArray | null;
          while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
            const event = buffer.slice(0, boundary.index);
            buffer = buffer.slice(boundary.index + boundary[0].length);
            const data = event.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).replace(/^ /, "")).join("\n");
            if (!data) continue;
            const rpc = JSON.parse(data) as RpcResponse;
            if (rpc.id === undefined || rpc.id === id) {
              if (rpc.result || rpc.error) return checked(rpc);
            }
          }
        }
        if (done) throw new Error("MCP response is incomplete");
      }
    } finally { await reader.cancel().catch(() => {}); }
  }
  const init = await call("initialize", 1, { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "boomkin-doctor", version: "1" } });
  const result = init?.result;
  if (!result?.serverInfo || typeof result.serverInfo !== "object" || Array.isArray(result.serverInfo) || !("name" in result.serverInfo) || typeof result.serverInfo.name !== "string" || !result.serverInfo.name || typeof result.protocolVersion !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(result.protocolVersion)) throw new Error("MCP initialization failed");
  protocol = result.protocolVersion;
  await call("notifications/initialized");
  const names = new Set<string>(), cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 8; page++) {
    const listed = (await call("tools/list", page + 2, cursor ? { cursor } : {}))?.result;
    if (!listed || !Array.isArray(listed.tools)) throw new Error("Malformed MCP tool discovery");
    for (const tool of listed.tools) {
      if (!tool || typeof tool !== "object" || typeof tool.name !== "string" || !tool.name) throw new Error("Malformed MCP tool name");
      if (names.has(tool.name)) throw new Error("Duplicate MCP tool name");
      names.add(tool.name);
    }
    if (listed.nextCursor === undefined) {
      if (!reviewedTools.every(name => names.has(name))) throw new Error("Reviewed MCP tool contract changed");
      return { tools: [...reviewedTools], discovered: names.size, serverInfo: result.serverInfo };
    }
    if (typeof listed.nextCursor !== "string" || !listed.nextCursor || cursors.has(listed.nextCursor)) throw new Error("Malformed MCP pagination");
    cursors.add(listed.nextCursor);
    cursor = listed.nextCursor;
  }
  throw new Error("MCP discovery exceeds the page limit");
}
