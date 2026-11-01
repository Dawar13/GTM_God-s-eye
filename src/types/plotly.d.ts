/** plotly.js-dist-min ships no types; only what Bubbles3D calls is declared. */
declare module "plotly.js-dist-min" {
  const Plotly: {
    relayout: (graphDiv: HTMLElement, update: Record<string, unknown>) => Promise<unknown>;
    restyle: (
      graphDiv: HTMLElement,
      update: Record<string, unknown>,
      traces?: number[],
    ) => Promise<unknown>;
  };
  export default Plotly;
}
