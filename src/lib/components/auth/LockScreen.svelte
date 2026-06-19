<script lang="ts">
  import { Lock, ShieldCheck, Warning, Eye, EyeSlash } from 'phosphor-svelte';
  import { vault } from '$lib/stores/vault';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';

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

  <div class="relative z-10 w-full max-w-sm">
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
      <div class="relative">
        <Input
          id="passphrase"
          type={show ? 'text' : 'password'}
          bind:value={passphrase}
          placeholder="Passphrase"
          autocomplete={firstRun ? 'new-password' : 'current-password'}
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          class="h-11 pr-10 text-[0.9375rem]"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted hover:text-ink"
          aria-label={show ? 'Hide passphrase' : 'Show passphrase'}
          onclick={() => (show = !show)}
        >
          {#if show}<EyeSlash size={18} />{:else}<Eye size={18} />{/if}
        </Button>
      </div>

      {#if firstRun}
        <label class="sr-only" for="confirm">Confirm passphrase</label>
        <Input
          id="confirm"
          type={show ? 'text' : 'password'}
          bind:value={confirm}
          placeholder="Confirm passphrase"
          autocomplete="new-password"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          class="h-11 text-[0.9375rem]"
        />
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
        <p class="px-1 text-xs text-muted/80">Locks automatically after 1 hour of inactivity.</p>
      {/if}

      <Button type="submit" class="mt-1 h-11 w-full text-[0.9375rem]" disabled={!canSubmit}>
        {#if busy}
          {firstRun ? 'Setting up…' : 'Unlocking…'}
        {:else}
          {firstRun ? 'Create vault' : 'Unlock'}
        {/if}
      </Button>
    </form>

    {#if firstRun}
      <div class="mt-5 flex items-start gap-2 rounded-control border border-warn/30 bg-surface p-3 shadow-sm">
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

  /* Faint film-grain dithering: smooth gradients (the page wash + the blurred
     orbs) quantize into visible bands on 8-bit panels. A subtle high-frequency
     noise layer breaks up those steps so the falloff reads as continuous.
     Sits above the orbs (which are z-0 absolute children) but below the
     content card; pointer-events disabled so it never intercepts clicks. */
  .lock-surface::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    opacity: 0.035;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 160px 160px;
  }
  :global(.dark) .lock-surface::after {
    opacity: 0.05;
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
    --a: 0.26;
    background: radial-gradient(circle, rgb(var(--c-accent) / var(--a)), rgb(var(--c-accent) / 0) 72%);
    animation: float-a 18s ease-in-out infinite;
  }
  .glow-soft {
    bottom: -15%;
    left: -10%;
    height: 38vmax;
    width: 38vmax;
    --a: 0.08;
    background: radial-gradient(circle, rgb(var(--c-ink) / var(--a)), rgb(var(--c-ink) / 0) 72%);
  }
  :global(.dark) .glow-soft {
    background: radial-gradient(circle, rgb(255 255 255 / var(--a)), rgb(255 255 255 / 0) 72%);
  }

  /* Extra bokeh orbs — accent (teal) + income (green) */
  .glow-income-bl {
    bottom: -5%;
    left: 15%;
    height: 30vmax;
    width: 30vmax;
    --a: 0.22;
    background: radial-gradient(circle, rgb(var(--c-income) / var(--a)), rgb(var(--c-income) / 0) 70%);
    animation: float-b 22s ease-in-out infinite;
  }
  .glow-accent-tl {
    top: 5%;
    left: -8%;
    height: 28vmax;
    width: 28vmax;
    --a: 0.2;
    background: radial-gradient(circle, rgb(var(--c-accent) / var(--a)), rgb(var(--c-accent) / 0) 68%);
    animation: float-c 26s ease-in-out infinite;
  }
  .glow-income-mid {
    top: 40%;
    right: 5%;
    height: 22vmax;
    width: 22vmax;
    --a: 0.18;
    background: radial-gradient(circle, rgb(var(--c-income) / var(--a)), rgb(var(--c-income) / 0) 64%);
    animation: float-a 20s ease-in-out infinite reverse;
  }
  .glow-accent-br {
    bottom: 10%;
    right: -8%;
    height: 26vmax;
    width: 26vmax;
    --a: 0.21;
    background: radial-gradient(circle, rgb(var(--c-accent) / var(--a)), rgb(var(--c-accent) / 0) 68%);
    animation: float-b 24s ease-in-out infinite reverse;
  }

  /* On phones, vmax sizing makes the orbs as wide as the screen is *tall*, so
     they sprawl across the centre and wash out the icon/title/inputs. Re-size
     them in vw (relative to the narrow width) and pin each one to the far left
     or right edge with its centre off-screen, leaving a clear central column
     for the content. Alpha is bumped and the blur tightened so the slivers that
     bleed in from the sides still read. */
  @media (max-width: 640px) {
    .glow {
      filter: blur(55px);
      width: 56vw;
      height: 56vw;
    }
    /* right-edge orbs */
    .glow-accent {
      top: -6%;
      right: -30%;
      left: auto;
      bottom: auto;
      --a: 0.46;
    }
    .glow-income-mid {
      top: auto;
      bottom: 14%;
      right: -32%;
      left: auto;
      --a: 0.34;
    }
    .glow-accent-br {
      bottom: -6%;
      right: -28%;
      top: auto;
      left: auto;
      --a: 0.42;
    }
    /* left-edge orbs */
    .glow-accent-tl {
      top: -3%;
      left: -30%;
      right: auto;
      bottom: auto;
      --a: 0.4;
    }
    .glow-income-bl {
      bottom: -6%;
      left: -28%;
      top: auto;
      right: auto;
      --a: 0.44;
    }
    .glow-soft {
      bottom: 26%;
      left: -32%;
      top: auto;
      right: auto;
      --a: 0.14;
    }
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

</style>
