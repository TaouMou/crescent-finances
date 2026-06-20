<script lang="ts">
  import type { Snippet } from 'svelte';
  import { scale, fly, fade } from 'svelte/transition';
  import { X } from 'phosphor-svelte';
  import { portal } from '$lib/actions/portal';

  let {
    open = $bindable(),
    label,
    title,
    align = 'left',
    widthClass = 'w-[244px]',
    children
  }: {
    open: boolean;
    label: string;
    /** Header shown on the mobile full-screen sheet (defaults to `label`). */
    title?: string;
    align?: 'left' | 'right';
    /** Desktop popover width class (ignored on mobile, where it's full width). */
    widthClass?: string;
    children: Snippet;
  } = $props();

  const reduce =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Below Tailwind's `sm` breakpoint we render a native-style full-screen sheet.
  let isMobile = $state(false);
  $effect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(max-width: 639px)');
    isMobile = mq.matches;
    const on = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });

  // Lock body scroll while the mobile sheet is up.
  $effect(() => {
    if (typeof document === 'undefined') return;
    if (open && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') open = false;
  }}
/>

{#if open}
  {#if isMobile}
    <!-- Full-screen mobile sheet, portaled to <body> so it escapes any
         transformed/clipping ancestor. -->
    <div class="fixed inset-0 z-[60] flex flex-col justify-end" use:portal>
      <button
        class="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
        aria-label="Close {label.toLowerCase()}"
        onclick={() => (open = false)}
        transition:fade={{ duration: reduce ? 0 : 150 }}
      ></button>

      <div
        class="relative max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-surface pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-1 ring-hairline"
        style="box-shadow: var(--shadow-card)"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        transition:fly={{ y: reduce ? 0 : 320, duration: reduce ? 0 : 260, opacity: 1 }}
      >
        <!-- grab handle -->
        <div class="flex justify-center pt-2.5">
          <span class="h-1 w-9 rounded-full bg-hairline"></span>
        </div>

        <header class="flex items-center justify-between px-4 pb-1 pt-2">
          <h2 class="text-base font-semibold text-ink">{title ?? label}</h2>
          <button
            type="button"
            onclick={() => (open = false)}
            aria-label="Done"
            class="press grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
          >
            <X class="h-5 w-5" />
          </button>
        </header>

        <div class="px-4 pt-1">
          {@render children()}
        </div>
      </div>
    </div>
  {:else}
    <!-- Desktop anchored popover (parent must be `relative`). -->
    <button
      class="fixed inset-0 z-40 cursor-default"
      tabindex="-1"
      aria-hidden="true"
      onclick={() => (open = false)}
    ></button>

    <div
      class="absolute top-full z-50 mt-2 {widthClass} max-w-[calc(100vw-1rem)] rounded-card bg-surface p-3 ring-1 ring-hairline {align ===
      'right'
        ? 'right-0 origin-top-right'
        : 'left-0 origin-top-left'}"
      style="box-shadow: var(--shadow-card)"
      role="dialog"
      aria-label={label}
      transition:scale={{ duration: reduce ? 0 : 150, start: 0.96, opacity: 0 }}
    >
      {@render children()}
    </div>
  {/if}
{/if}
