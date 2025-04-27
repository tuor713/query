import perspective_viewer from "@finos/perspective-viewer";
import perspective from "@finos/perspective";
import "@finos/perspective-viewer-datagrid";
import "@finos/perspective-viewer-d3fc";

import SERVER_WASM from "@finos/perspective/dist/wasm/perspective-server.wasm?url";
import CLIENT_WASM from "@finos/perspective-viewer/dist/wasm/perspective-viewer.wasm?url";

export async function initializePerspective() {
    console.log("Loading WASM");
    await perspective.init_server(fetch(SERVER_WASM));
    await perspective_viewer.init_client(fetch(CLIENT_WASM));
    console.log("Done loading WASM");
}