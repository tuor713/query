import * as vg from "@uwdata/vgplot";
import { Coordinator, wasmConnector } from "@uwdata/vgplot";
import { GoldenLayout } from "golden-layout";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-light-theme.css";
import {
    createFetchFromTrino,
    createLoadTrino,
    createPerspectivePanel,
} from "./dashboardRuntime.js";
import { createGoldenBuilder } from "./goldenBuilder.js";

/**
 * Manages the full lifecycle of a dashboard execution: Mosaic coordinator,
 * DuckDB connector, GoldenLayout instance, and user snippet evaluation.
 *
 * Usage:
 *   const db = new Dashboard({ queryService, username, password, selectedEnvironment, extraCredentials });
 *   await db.mount(element, code, { onQueryLog, layoutState, onLayoutStateChange });
 *   // later:
 *   db.destroy();
 */
export class Dashboard {
    #coordinator = null;
    #dbConnector = null;
    #glInstance = null;
    #queryLog = [];
    #opts;

    constructor(opts) {
        this.#opts = opts;
    }

    get queryLog() {
        return this.#queryLog;
    }

    /**
     * @param {HTMLElement} element
     * @param {string} code
     * @param {{
     *   onQueryLog?: (log: any[]) => void,
     *   layoutState?: any,
     *   onLayoutStateChange?: (state: any) => void,
     * }} [opts]
     */
    async mount(element, code, { onQueryLog, layoutState, onLayoutStateChange } = {}) {
        this.#cleanup();
        element.innerHTML = "";
        this.#queryLog = [];

        this.#coordinator = new Coordinator();
        this.#dbConnector = wasmConnector();
        this.#coordinator.databaseConnector(this.#dbConnector);
        vg.coordinator(this.#coordinator);

        const logQueryStatus = (entry) => {
            if (entry.status === "running") {
                this.#queryLog = [...this.#queryLog, entry];
            } else {
                this.#queryLog = this.#queryLog.map((q) =>
                    q.sql === entry.sql && q.status === "running" ? entry : q,
                );
            }
            onQueryLog?.(this.#queryLog);
        };

        const fetchFromTrino = createFetchFromTrino({ ...this.#opts, logQueryStatus });
        const loadTrino = createLoadTrino(fetchFromTrino, this.#dbConnector);
        const perspective = createPerspectivePanel(this.#dbConnector, this.#coordinator);
        const golden = createGoldenBuilder(GoldenLayout);

        // eslint-disable-next-line no-new-func
        const fn = new Function(
            "vg",
            "container",
            "loadTrino",
            "perspective",
            "golden",
            `"use strict"; return (async () => { ${code} })();`,
        );
        const result = await fn(vg, element, loadTrino, perspective, golden);

        if (result && typeof result.saveLayout === "function") {
            this.#glInstance = result;
            if (onLayoutStateChange) {
                this.#glInstance.on("stateChanged", () => {
                    try {
                        onLayoutStateChange(this.#glInstance.saveLayout());
                    } catch (_) {}
                });
            }
            if (layoutState) {
                try {
                    this.#glInstance.loadLayout(layoutState);
                } catch (_) {}
            }
        }
    }

    updateRootSize() {
        this.#glInstance?.updateRootSize();
    }

    destroy() {
        this.#cleanup();
    }

    #cleanup() {
        if (this.#glInstance) {
            try {
                this.#glInstance.destroy();
            } catch (_) {}
            this.#glInstance = null;
        }
        if (this.#coordinator) {
            try {
                this.#coordinator.clear();
            } catch (_) {}
            this.#coordinator = null;
        }
        this.#dbConnector = null;
    }
}
