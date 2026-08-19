<script lang="ts">
  let {
    size = "md",
    class: klass = "",
  }: { size?: "md" | "lg"; class?: string } = $props();

  const text = size === "lg" ? "text-2xl" : "text-lg";
</script>

<span class="font-sans font-bold tracking-tight {text} {klass}">
  <span class="text-lime">c</span>aleta
</span>
