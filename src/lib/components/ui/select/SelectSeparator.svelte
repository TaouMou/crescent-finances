<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils/cn';

  let { class: className, ...restProps }: HTMLAttributes<HTMLHRElement> & { class?: string } = $props();
</script>

<hr class={cn('-mx-1 my-1 border-hairline', className)} {...restProps} />
