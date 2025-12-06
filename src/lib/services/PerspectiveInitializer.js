import perspective_viewer from "@perspective-dev/viewer";
import perspective from "@perspective-dev/client";
import "@perspective-dev/viewer-datagrid";
import "@perspective-dev/viewer-d3fc";

import SERVER_WASM from "@perspective-dev/server/dist/wasm/perspective-server.wasm?url";
import CLIENT_WASM from "@perspective-dev/viewer/dist/wasm/perspective-viewer.wasm?url";

export async function initializePerspective() {
  console.log("Loading WASM");
  console.log("server wasm", SERVER_WASM);
  console.log("client wasm", CLIENT_WASM);
  perspective.init_server(fetch(SERVER_WASM));
  await perspective_viewer.init_client(fetch(CLIENT_WASM));
  console.log("Done loading WASM");
}
