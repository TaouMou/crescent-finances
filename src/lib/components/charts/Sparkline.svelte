<script lang="ts">
  // Tiny hand-rolled SVG sparkline. No dependency; animates via CSS only.
  let {
    values,
    color = 'rgb(var(--c-accent))',
    width = 96,
    height = 28,
    strokeWidth = 1.5
  }: {
    values: number[];
    color?: string;
    width?: number;
    height?: number;
    strokeWidth?: number;
  } = $props();

  const path = $derived.by(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = width / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / span) * (height - strokeWidth * 2) - strokeWidth;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });
</script>

<svg
  width="100%"
  {height}
  viewBox={`0 0 ${width} ${height}`}
  preserveAspectRatio="none"
  fill="none"
  aria-hidden="true"
  class="block"
>
  <path d={path} stroke={color} stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
</svg>
