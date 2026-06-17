<script lang="ts">
  import { X } from 'phosphor-svelte';
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: Snippet;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  });

  function onclose() {
    open = false;
  }

  function onbackdropclick(e: MouseEvent) {
    if (e.target === dialog) {
      open = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  {onclose}
  onclick={onbackdropclick}
  class="modal-dialog"
>
  <div class="w-full max-w-lg rounded-xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-base font-semibold text-ink">{title}</h2>
      <button
        class="press grid h-8 w-8 place-items-center rounded-control text-muted hover:bg-ink/5 hover:text-ink active:bg-ink/10"
        onclick={() => { open = false; }}
        aria-label="Close"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
    {@render children()}
  </div>
</dialog>

<style>
  .modal-dialog {
    margin: auto;
    padding: 0;
    border: none;
    background: transparent;
    max-width: calc(100vw - 2rem);
    width: 100%;
    max-height: calc(100vh - 4rem);
    overflow: visible;
  }

  .modal-dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
    backdrop-filter: blur(2px);
  }

  .modal-dialog[open] {
    display: flex;
    align-items: center;
    justify-content: center;
    animation: modal-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .modal-dialog[open]::backdrop {
    animation: backdrop-in 200ms ease both;
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
</style>
