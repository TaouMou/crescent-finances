<script lang="ts">
  import { untrack } from 'svelte';

  let {
    value,
    format,
    duration = 700,
    class: cls = ''
  }: {
    value: number;
    format: (n: number) => string;
    duration?: number;
    class?: string;
  } = $props();

  let displayed = $state(0);
  let rafId = 0;

  $effect(() => {
    const target = value;
    const start = untrack(() => displayed);
    if (target === start) return;

    const delta = target - start;
    const startTime = performance.now();
    cancelAnimationFrame(rafId);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      displayed = Math.round(start + delta * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        displayed = target;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });
</script>

<span class={cls}>{format(displayed)}</span>
