/**
 * Creates a declarative Golden Layout builder.
 * Returns a `golden` object with panel/row/col/layout helpers.
 *
 * @param {typeof import('golden-layout').GoldenLayout} GoldenLayout
 * @returns {{ panel, row, col, layout }}
 */
export function createGoldenBuilder(GoldenLayout) {
    let _panelCounter = 0;
    /** @type {Map<string, HTMLElement>} */
    const _pendingPanels = new Map();

    return {
        panel(title, element, options = {}) {
            const componentType = `__panel_${++_panelCounter}`;
            _pendingPanels.set(componentType, element);
            return { type: "component", componentType, title, ...options };
        },
        row(...items) {
            return { type: "row", content: items.flat() };
        },
        col(...items) {
            return { type: "column", content: items.flat() };
        },
        layout(containerEl, rootConfig) {
            const gl = new GoldenLayout(containerEl);
            for (const [componentType, element] of _pendingPanels) {
                gl.registerComponentFactoryFunction(componentType, (glContainer) => {
                    glContainer.element.style.overflow = "auto";
                    glContainer.element.appendChild(element);
                });
            }
            gl.loadLayout({ root: rootConfig });
            return gl;
        },
    };
}
