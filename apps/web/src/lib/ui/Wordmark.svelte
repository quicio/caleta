<script lang="ts">
  let {
    size = "md",
    class: klass = "",
  }: { size?: "md" | "lg"; class?: string } = $props();

  const text = size === "lg" ? "text-[2rem]" : "text-[1.45rem]";
</script>

<span class="font-sans font-bold tracking-[-0.07em] {text} {klass}">
  <span class="text-lime">caleta</span>
</span>
