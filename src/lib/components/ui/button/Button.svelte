<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { tv, type VariantProps } from 'tailwind-variants';
  import { cn } from '$lib/utils/cn';

  const buttonVariants = tv({
    base: 'press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent/90',
        destructive: 'bg-expense text-white hover:bg-expense/90',
        outline: 'border border-hairline bg-transparent hover:bg-ink/5 hover:text-ink',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-ink/5 hover:text-ink',
        link: 'text-accent underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-8',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  });

  type Variant = VariantProps<typeof buttonVariants>['variant'];
  type Size = VariantProps<typeof buttonVariants>['size'];

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: Size;
    class?: string;
  }

  let {
    variant = 'default',
    size = 'default',
    class: className,
    children,
    ...restProps
  }: Props = $props();
</script>

<button class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
  {@render children?.()}
</button>
