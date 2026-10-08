import { expect, test } from "bun:test";
import { discoverPublicMcp, type Fetcher } from "../src/mcp-discovery.ts";

function fixture(listed: (params: Record<string, unknown>, id: number) => unknown): Fetcher {
  return async (_url, options) => {
    expect(options.redirect).toBe("error");
    expect(Object.keys(options.headers as Record<string, string>).some(key => /authorization|api.key/i.test(key))).toBe(false);
    const { method, id, params } = JSON.parse(options.body as string);
    if (method === "initialize") return Response.json({ jsonrpc: "2.0", id, result: { protocolVersion: "2025-03-26", serverInfo: { name: "fixture" } } });
    if (method === "notifications/initialized") return new Response(null, { status: 202 });
    expect(method).toBe("tools/list");
    return Response.json({ jsonrpc: "2.0", id, result: listed(params, id) });
  };
}

test("discovery finds reviewed tools across bounded pagination without calling tools or sending credentials", async () => {
  const cursors: unknown[] = [];
  const result = await discoverPublicMcp("https://example.test/mcp", ["read-one", "read-two"], fixture(params => {
    cursors.push(params.cursor);
    return params.cursor ? { tools: [{ name: "read-two" }, { name: "unreviewed" }] } : { tools: [{ name: "read-one" }], nextCursor: "page-two" };
  }));
  expect(cursors).toEqual([undefined, "page-two"]);
  expect(result).toMatchObject({ tools: ["read-one", "read-two"], discovered: 3 });
});

test("SSE discovery handles comments, progress notifications, multiline data and split CRLF frames", async () => {
  const encoder = new TextEncoder();
  const result = await discoverPublicMcp("https://example.test/mcp", ["read"], async (_url, options) => {
    const { method, id } = JSON.parse(options.body as string);
    if (method !== "tools/list") return fixture(() => ({}))("https://example.test/mcp", options);
    const chunks = [": heartbeat\r\n\r", '\nid: 99\r\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\r\n\r\n', `event: message\r\ndata: {"jsonrpc":"2.0","id":${id},\r\ndata: "result":{"tools":[{"name":"read"}]}}\r\n\r\n`];
    return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } }), { headers: { "Content-Type": "text/event-stream" } });
  });
  expect(result.tools).toEqual(["read"]);
});

test("removed or malformed tools, cyclic pagination, excessive pages and oversized responses fail closed", async () => {
  for (const result of [
    { tools: [{ name: "other" }] }, { tools: "malformed" }, { tools: [{ name: null }] },
    { tools: [{ name: "read" }, { name: "read" }] }, { tools: [], nextCursor: "" },
  ]) await expect(discoverPublicMcp("https://example.test/mcp", ["read"], fixture(() => result))).rejects.toThrow();
  await expect(discoverPublicMcp("https://example.test/mcp", ["read"], fixture(() => ({ tools: [], nextCursor: "repeat" })))).rejects.toThrow("pagination");
  await expect(discoverPublicMcp("https://example.test/mcp", ["read"], fixture((_params, id) => ({ tools: [], nextCursor: `page-${id}` })))).rejects.toThrow("page limit");
  await expect(discoverPublicMcp("https://example.test/mcp", [], async () => new Response(" ".repeat(1_048_577)))).rejects.toThrow("Oversized");
});

test("wrong JSON-RPC result IDs, error objects and redirects are rejected", async () => {
  for (const response of [
    Response.json({ jsonrpc: "2.0", id: 99, result: { protocolVersion: "2025-03-26", serverInfo: {} } }),
    Response.json({ error: { message: "private upstream diagnostic" } }),
    new Response(null, { status: 302, headers: { Location: "https://another.test" } }),
  ]) await expect(discoverPublicMcp("https://example.test/mcp", [], async () => response)).rejects.toThrow();
});
