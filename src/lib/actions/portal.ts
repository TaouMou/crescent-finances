/**
 * Svelte action that relocates an element to `document.body` (or a given
 * target) so fixed-position overlays escape any `transform`/`overflow`
 * clipping ancestor. Used by the full-screen mobile picker sheets.
 */
export function portal(node: HTMLElement, target: HTMLElement | string = document.body) {
  let dest: HTMLElement | null = null;

  function mount(t: HTMLElement | string) {
    dest = typeof t === 'string' ? document.querySelector<HTMLElement>(t) : t;
    if (dest) dest.appendChild(node);
  }

  mount(target);

  return {
    update(t: HTMLElement | string) {
      mount(t);
    },
    destroy() {
      node.parentNode?.removeChild(node);
    }
  };
}
