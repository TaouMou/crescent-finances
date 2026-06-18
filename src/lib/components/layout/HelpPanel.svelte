<script lang="ts">
  import { Lightbulb } from 'phosphor-svelte';
  import type { PageHelp } from '$lib/help/registry';

  let { help }: { help: PageHelp } = $props();
</script>

<div class="space-y-4">
  <p class="text-sm text-muted">{help.intro}</p>

  {#if help.sections?.length}
    <div class="space-y-3">
      {#each help.sections as s (s.heading)}
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-ink/80">{s.heading}</h3>
          <p class="mt-1 text-sm text-muted">{s.body}</p>
        </div>
      {/each}
    </div>
  {/if}

  {#if help.example}
    <div class="flex gap-2 rounded-control border border-accent/20 bg-accent/5 p-3">
      <Lightbulb class="h-4 w-4 shrink-0 text-accent" />
      <p class="text-sm text-ink/90">{help.example}</p>
    </div>
  {/if}

  {#if help.terms?.length}
    <div>
      <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink/80">Key terms</h3>
      <dl class="space-y-2">
        {#each help.terms as t (t.term)}
          <div>
            <dt class="text-sm font-medium text-ink">{t.term}</dt>
            <dd class="text-sm text-muted">{t.def}</dd>
          </div>
        {/each}
      </dl>
    </div>
  {/if}
</div>
