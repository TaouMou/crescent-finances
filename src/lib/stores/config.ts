/**
 * Config store: the loaded, validated configuration (accounts, categories,
 * sections, rules, …). Financial-data-free and persisted in clear via configRepo.
 */

import { writable } from 'svelte/store';
import { configRepo } from '$lib/db/repos';
import { emptyConfig } from '$lib/config/defaults';
import type { AppConfig } from '$lib/types';

function createConfigStore() {
  const { subscribe, set } = writable<AppConfig | null>(null);

  async function load(): Promise<void> {
    const cfg = (await configRepo.get()) ?? emptyConfig();
    set(cfg);
  }

  async function save(config: AppConfig): Promise<void> {
    await configRepo.save(config);
    set(config);
  }

  return { subscribe, load, save };
}

export const config = createConfigStore();
