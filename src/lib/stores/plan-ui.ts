/**
 * Tiny cross-component flag so the sidebar's "+ New group" button can ask the
 * Plan view to open its new-group editor after navigation. PlanView consumes and
 * resets it on mount.
 */

import { writable } from 'svelte/store';

export const openNewGroupRequested = writable(false);
