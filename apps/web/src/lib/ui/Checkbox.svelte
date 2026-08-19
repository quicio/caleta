<script lang="ts">
  let {
    checked = $bindable(false),
    disabled = false,
    class: klass = "",
    onclick,
  }: {
    checked?: boolean;
    disabled?: boolean;
    class?: string;
    onclick?: () => void;
  } = $props();
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked}
  disabled={disabled}
  onclick={() => {
    checked = !checked;
    onclick?.();
  }}
  class="group inline-flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition-colors duration-150 {checked
    ? 'border-lime bg-lime text-ink'
    : 'border-surface-2 bg-transparent text-transparent hover:border-lime/40'} {disabled
    ? 'cursor-not-allowed opacity-40'
    : ''} {klass}"
>
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
</button>
