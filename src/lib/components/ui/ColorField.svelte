<script lang="ts">
  import { Check } from 'phosphor-svelte';
  import PickerOverlay from './PickerOverlay.svelte';
  import {
    hexToHsv,
    hsvToHex,
    normalizeHex,
    contrastInk,
    type HSV
  } from '$lib/utils/color';

  let {
    value = $bindable(),
    label = 'Color',
    block = false,
    class: cls = '',
    onValue
  }: {
    value: string;
    label?: string;
    /** Full-width trigger showing the swatch + hex (vs a compact square chip). */
    block?: boolean;
    /** Extra classes for the trigger button. */
    class?: string;
    /** Called with the new hex whenever the color changes (for non-bound use). */
    onValue?: (hex: string) => void;
  } = $props();

  // Curated, on-brand palette (starter categories + a few extra hues/neutrals).
  const PRESETS = [
    '#1a9e6f', '#0da882', '#14776b', '#11797e', '#2b8ab5', '#3b6fb0',
    '#6b9e40', '#c9a227', '#d49820', '#d4843a', '#d0382d', '#c0567e',
    '#8a6fb0', '#a0541e', '#4a4f55', '#6e7a82', '#9a9fa5', '#1a1d21'
  ];

  let open = $state(false);
  let trigger = $state<HTMLButtonElement>();
  let align = $state<'left' | 'right'>('left');

  // Working HSV state. Kept independent of `value` so hue survives moves into
  // achromatic regions (grey/black), where hex→hsv would lose it.
  let hsv = $state<HSV>(hexToHsv(value || '#0da882'));
  // Raw text in the hex field (may be mid-edit / invalid).
  let hexInput = $state(value || '#0da882');

  const hex = $derived(hsvToHex(hsv));
  const hueColor = $derived(hsvToHex({ h: hsv.h, s: 100, v: 100 }));

  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  function open_() {
    hsv = hexToHsv(value || '#0da882');
    hexInput = normalizeHex(value) ?? '#0da882';
    const rect = trigger?.getBoundingClientRect();
    const vw = typeof window !== 'undefined' ? window.innerWidth : Infinity;
    align = rect && rect.left + 244 > vw - 8 ? 'right' : 'left';
    open = true;
  }

  function setValue(c: string) {
    value = c;
    onValue?.(c);
  }

  function commit() {
    setValue(hex);
    hexInput = hex;
  }

  // --- pointer dragging for the SV area and hue slider ---
  function drag(node: HTMLElement, onMove: (rect: DOMRect, e: PointerEvent) => void) {
    function move(e: PointerEvent) {
      onMove(node.getBoundingClientRect(), e);
    }
    function down(e: PointerEvent) {
      e.preventDefault();
      node.setPointerCapture(e.pointerId);
      move(e);
      node.addEventListener('pointermove', move);
    }
    function up(e: PointerEvent) {
      try {
        node.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be gone
      }
      node.removeEventListener('pointermove', move);
    }
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointerup', up);
    return {
      destroy() {
        node.removeEventListener('pointerdown', down);
        node.removeEventListener('pointerup', up);
      }
    };
  }

  function onSV(rect: DOMRect, e: PointerEvent) {
    hsv = {
      h: hsv.h,
      s: clamp((e.clientX - rect.left) / rect.width, 0, 1) * 100,
      v: (1 - clamp((e.clientY - rect.top) / rect.height, 0, 1)) * 100
    };
    commit();
  }
  function onHue(rect: DOMRect, e: PointerEvent) {
    hsv = { ...hsv, h: clamp((e.clientX - rect.left) / rect.width, 0, 1) * 360 };
    commit();
  }

  function onHexInput(v: string) {
    hexInput = v;
    const n = normalizeHex(v);
    if (n) {
      hsv = hexToHsv(n);
      setValue(n);
    }
  }

  function pickPreset(c: string) {
    hsv = hexToHsv(c);
    setValue(c);
    hexInput = c;
  }

  // Keyboard nudge on the SV area for accessibility.
  function svKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') hsv = { ...hsv, s: clamp(hsv.s - step, 0, 100) };
    else if (e.key === 'ArrowRight') hsv = { ...hsv, s: clamp(hsv.s + step, 0, 100) };
    else if (e.key === 'ArrowUp') hsv = { ...hsv, v: clamp(hsv.v + step, 0, 100) };
    else if (e.key === 'ArrowDown') hsv = { ...hsv, v: clamp(hsv.v - step, 0, 100) };
    else return;
    e.preventDefault();
    commit();
  }
</script>

<div class="relative {block ? 'block' : 'inline-block'}">
  {#if block}
    <button
      bind:this={trigger}
      type="button"
      onclick={open_}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      class="press flex h-9 w-full items-center gap-2 rounded-control border border-hairline bg-surface px-2 text-sm text-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 {cls}"
    >
      <span
        class="h-5 w-5 shrink-0 rounded-[5px] ring-1 ring-inset ring-ink/15"
        style="background-color: {value || '#000000'}"
      ></span>
      <span class="tnum uppercase tracking-wide text-muted">{value || 'Pick'}</span>
    </button>
  {:else}
    <button
      bind:this={trigger}
      type="button"
      onclick={open_}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      class="press grid h-9 w-10 shrink-0 place-items-center rounded-control border border-hairline bg-surface hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 {cls}"
    >
      <span
        class="h-5 w-6 rounded-[4px] ring-1 ring-inset ring-ink/15"
        style="background-color: {value || '#000000'}"
      ></span>
    </button>
  {/if}

  <PickerOverlay bind:open {label} title={label} {align} widthClass="w-[244px]">
    <!-- Saturation / Value area -->
    <div
      use:drag={onSV}
      onkeydown={svKey}
      role="slider"
      tabindex="0"
      aria-label="Saturation and brightness"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(hsv.v)}
      aria-valuetext="{Math.round(hsv.s)}% saturation, {Math.round(hsv.v)}% brightness"
      class="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-control ring-1 ring-inset ring-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      style="background-color: {hueColor};
        background-image: linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0));"
    >
      <span
        class="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
        style="left: {hsv.s}%; top: {100 - hsv.v}%; background-color: {hex}"
      ></span>
    </div>

    <!-- Hue slider -->
    <div
      use:drag={onHue}
      role="slider"
      tabindex="0"
      aria-label="Hue"
      aria-valuemin="0"
      aria-valuemax="360"
      aria-valuenow={Math.round(hsv.h)}
      onkeydown={(e) => {
        const step = e.shiftKey ? 20 : 5;
        if (e.key === 'ArrowLeft') hsv = { ...hsv, h: clamp(hsv.h - step, 0, 360) };
        else if (e.key === 'ArrowRight') hsv = { ...hsv, h: clamp(hsv.h + step, 0, 360) };
        else return;
        e.preventDefault();
        commit();
      }}
      class="relative mt-3 h-4 w-full cursor-pointer touch-none rounded-full ring-1 ring-inset ring-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      style="background-image: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);"
    >
      <span
        class="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
        style="left: {(hsv.h / 360) * 100}%; background-color: {hueColor}"
      ></span>
    </div>

    <!-- Hex input + live preview -->
    <div class="mt-3 flex items-center gap-2">
      <span
        class="h-9 w-9 shrink-0 rounded-control ring-1 ring-inset ring-ink/15"
        style="background-color: {hex}"
      ></span>
      <div
        class="flex h-9 flex-1 items-center rounded-control border border-hairline bg-surface px-2 focus-within:ring-1 focus-within:ring-accent/50"
      >
        <span class="text-sm text-muted">#</span>
        <input
          type="text"
          value={(hexInput || '').replace(/^#/, '')}
          oninput={(e) => onHexInput('#' + e.currentTarget.value)}
          spellcheck="false"
          maxlength="6"
          aria-label="Hex color"
          class="tnum w-full bg-transparent text-sm uppercase tracking-wide text-ink focus:outline-none"
        />
      </div>
    </div>

    <!-- Presets -->
    <div class="mt-3 grid grid-cols-9 gap-1.5">
      {#each PRESETS as c (c)}
        {@const sel = normalizeHex(value) === c}
        <button
          type="button"
          onclick={() => pickPreset(c)}
          aria-label="Use {c}"
          aria-pressed={sel}
          class="press grid aspect-square w-full place-items-center rounded-[5px] ring-1 ring-inset ring-ink/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          style="background-color: {c}"
        >
          {#if sel}
            <Check class="h-3.5 w-3.5" weight="bold" style="color: {contrastInk(c)}" />
          {/if}
        </button>
      {/each}
    </div>
  </PickerOverlay>
</div>
