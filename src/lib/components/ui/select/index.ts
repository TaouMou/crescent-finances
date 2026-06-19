import { Select as SelectPrimitive } from 'bits-ui';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;
export const SelectLabel = SelectPrimitive.GroupHeading;

export { default as SelectTrigger } from './SelectTrigger.svelte';
export { default as SelectContent } from './SelectContent.svelte';
export { default as SelectItem } from './SelectItem.svelte';
export { default as SelectSeparator } from './SelectSeparator.svelte';
