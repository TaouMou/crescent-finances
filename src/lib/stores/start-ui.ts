/**
 * Cross-component flag: set when the user follows a step out of the
 * Getting-started page, so the app can show a "Back to Getting started" bar on
 * the destination route until they return or dismiss it.
 */

import { writable } from 'svelte/store';

export const returnToStart = writable(false);
