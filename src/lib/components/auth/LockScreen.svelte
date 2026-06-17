<script lang="ts">
  import { Lock, ShieldCheck, Warning, Eye, EyeSlash } from 'phosphor-svelte';
  import { vault } from '$lib/stores/vault';
  import { cn } from '$lib/utils/cn';

  // First run when there is no vault yet; otherwise we are unlocking.
  let { firstRun = false }: { firstRun?: boolean } = $props();

  let passphrase = $state('');
  let confirm = $state('');
  let show = $state(false);
  let busy = $state(false);
  let localError = $state<string | null>(null);

  const vaultError = $derived($vault.error);
  const error = $derived(localError ?? vaultError);

  // Minimal strength gate for first-run: discourage trivially weak passphrases
  // without imposing an opinionated policy.
  const tooShort = $derived(firstRun && passphrase.length > 0 && passphrase.length < 8);
  const mismatch = $derived(firstRun && confirm.length > 0 && confirm !== passphrase);
  const canSubmit = $derived(
    !busy &&
      passphrase.length >= 8 &&
      (!firstRun || (confirm === passphrase && confirm.length > 0))
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    localError = null;
    busy = true;
    try {
      if (firstRun) {
        await vault.setup(passphrase);
      } else {
        await vault.unlock(passphrase);
      }
    } catch (err) {
      localError = err instanceof Error ? err.message : 'Something went wrong.';
    } finally {
      busy = false;
      passphrase = firstRun && !$vault.error ? passphrase : passphrase; // keep value for retry
    }
  }
</script>

<div class="lock-surface relative flex min-h-screen w-screen items-center justify-center overflow-hidden p-6">
  <!-- Atmospheric bokeh: large washes + scattered orbs in accent/income hues. -->
  <div class="glow glow-accent" aria-hidden="true"></div>
  <div class="glow glow-soft" aria-hidden="true"></div>
  <div class="glow glow-income-bl" aria-hidden="true"></div>
  <div class="glow glow-accent-tl" aria-hidden="true"></div>
  <div class="glow glow-income-mid" aria-hidden="true"></div>
  <div class="glow glow-accent-br" aria-hidden="true"></div>

  <div class="relative w-full max-w-sm">
    <div class="mb-8 flex flex-col items-center text-center">
      <div
        class="mb-4 flex h-12 w-12 items-center justify-center rounded-control bg-accent/10 text-accent"
      >
        {#if firstRun}
          <ShieldCheck size={26} weight="regular" />
        {:else}
          <Lock size={24} weight="regular" />
        {/if}
      </div>
      <h1 class="text-lg font-medium tracking-tight text-ink">
        {firstRun ? 'Set your passphrase' : 'Welcome back'}
      </h1>
      <p class="mt-1 max-w-xs text-sm text-muted">
        {firstRun
          ? 'This passphrase encrypts everything on this device. Choose something memorable.'
          : 'Enter your passphrase to unlock your finances.'}
      </p>
    </div>

    <form onsubmit={submit} class="flex flex-col gap-3">
      <label class="sr-only" for="passphrase">Passphrase</label>
      <div class="field-pill">
        <input
          id="passphrase"
          type={show ? 'text' : 'password'}
          bind:value={passphrase}
          placeholder="Passphrase"
          autocomplete={firstRun ? 'new-password' : 'current-password'}
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          class="field-input"
        />
        <button
          type="button"
          class="press text-muted hover:text-ink"
          aria-label={show ? 'Hide passphrase' : 'Show passphrase'}
          onclick={() => (show = !show)}
        >
          {#if show}<EyeSlash size={18} />{:else}<Eye size={18} />{/if}
        </button>
      </div>

      {#if firstRun}
        <label class="sr-only" for="confirm">Confirm passphrase</label>
        <div class="field-pill">
          <input
            id="confirm"
            type={show ? 'text' : 'password'}
            bind:value={confirm}
            placeholder="Confirm passphrase"
            autocomplete="new-password"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            class="field-input"
          />
        </div>
      {/if}

      {#if tooShort}
        <p class="px-1 text-xs text-muted">Use at least 8 characters.</p>
      {:else if mismatch}
        <p class="px-1 text-xs text-expense">Passphrases don't match.</p>
      {:else if error}
        <p class="px-1 text-xs text-expense">{error}</p>
      {/if}

      <label class="flex items-center gap-2 px-1 text-sm text-muted">
        <input
          type="checkbox"
          checked={$vault.remember}
          onchange={(e) => vault.setRemember(e.currentTarget.checked)}
        />
        Keep me unlocked on this device
      </label>
      {#if $vault.remember}
        <p class="px-1 text-xs text-muted/80">Locks automatically after 15 minutes of inactivity.</p>
      {/if}

      <button type="submit" class={cn('submit-btn press', !canSubmit && 'opacity-50')} disabled={!canSubmit}>
        {#if busy}
          {firstRun ? 'Setting up…' : 'Unlocking…'}
        {:else}
          {firstRun ? 'Create vault' : 'Unlock'}
        {/if}
      </button>
    </form>

    {#if firstRun}
      <div class="mt-5 flex items-start gap-2 rounded-control border border-warn/30 bg-warn/5 p-3">
        <span class="mt-0.5 text-warn"><Warning size={16} weight="fill" /></span>
        <p class="text-xs leading-relaxed text-muted">
          There is no recovery. If you lose this passphrase, your data cannot be decrypted — not by
          us, not by anyone. Keep it somewhere safe.
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .lock-surface {
    background-image: linear-gradient(to bottom, rgb(var(--c-paper)), rgb(var(--c-paper-deep)));
  }

  .glow {
    position: absolute;
    border-radius: 9999px;
    filter: blur(80px);
    pointer-events: none;
  }
  .glow-accent {
    top: -10%;
    right: -5%;
    height: 42vmax;
    width: 42vmax;
    background: radial-gradient(circle, rgb(var(--c-accent) / 0.18), transparent 70%);
    animation: float-a 18s ease-in-out infinite;
  }
  .glow-soft {
    bottom: -15%;
    left: -10%;
    height: 38vmax;
    width: 38vmax;
    background: radial-gradient(circle, rgb(var(--c-ink) / 0.06), transparent 70%);
  }
  :global(.dark) .glow-soft {
    background: radial-gradient(circle, rgb(255 255 255 / 0.05), transparent 70%);
  }

  /* Extra bokeh orbs — accent (teal) + income (green) */
  .glow-income-bl {
    bottom: -5%;
    left: 15%;
    height: 30vmax;
    width: 30vmax;
    background: radial-gradient(circle, rgb(var(--c-income) / 0.14), transparent 68%);
    animation: float-b 22s ease-in-out infinite;
  }
  .glow-accent-tl {
    top: 5%;
    left: -8%;
    height: 28vmax;
    width: 28vmax;
    background: radial-gradient(circle, rgb(var(--c-accent) / 0.12), transparent 65%);
    animation: float-c 26s ease-in-out infinite;
  }
  .glow-income-mid {
    top: 40%;
    right: 5%;
    height: 22vmax;
    width: 22vmax;
    background: radial-gradient(circle, rgb(var(--c-income) / 0.10), transparent 60%);
    animation: float-a 20s ease-in-out infinite reverse;
  }
  .glow-accent-br {
    bottom: 10%;
    right: -8%;
    height: 26vmax;
    width: 26vmax;
    background: radial-gradient(circle, rgb(var(--c-accent) / 0.13), transparent 65%);
    animation: float-b 24s ease-in-out infinite reverse;
  }

  @keyframes float-a {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%       { transform: translate(-2%, 3%) scale(1.04); }
    66%       { transform: translate(3%, -2%) scale(0.97); }
  }
  @keyframes float-b {
    0%, 100% { transform: translate(0, 0) scale(1); }
    40%       { transform: translate(3%, -4%) scale(1.05); }
    70%       { transform: translate(-2%, 2%) scale(0.96); }
  }
  @keyframes float-c {
    0%, 100% { transform: translate(0, 0) scale(1); }
    30%       { transform: translate(4%, 2%) scale(0.98); }
    60%       { transform: translate(-3%, -3%) scale(1.03); }
  }

  .field-pill {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0 0.875rem;
    border-radius: var(--radius-control, 6px);
    border: 1px solid rgb(var(--c-hairline));
    background-color: rgb(var(--c-surface));
    box-shadow: 0 1px 2px rgb(26 29 33 / 0.03);
  }
  .field-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: rgb(var(--c-ink));
    font-size: 0.9375rem;
  }
  .field-input::placeholder {
    color: rgb(var(--c-muted));
  }

  .submit-btn {
    margin-top: 0.25rem;
    min-height: 44px;
    border-radius: var(--radius-control, 6px);
    background-color: rgb(var(--c-accent));
    color: rgb(255 255 255);
    font-weight: 500;
    font-size: 0.9375rem;
  }
  .submit-btn:disabled {
    cursor: not-allowed;
  }
</style>
