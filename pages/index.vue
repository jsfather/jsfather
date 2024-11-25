<script setup lang="ts">
const themeStore = useThemeStore();
</script>
<template>
  <div class="flex min-h-[calc(100vh-90px)] flex-col justify-center gap-8">
    <h1 class="text-4xl font-black text-white md:text-6xl lg:text-8xl">hi</h1>
    <h1 class="text-4xl font-thin text-white md:text-6xl lg:text-8xl">
      my name is
      <strong
        class="font-bold"
        :class="`text-${themeStore.selectedTheme?.color}`"
        >jsfather</strong
      >
    </h1>
    <h1 class="text-4xl font-medium text-white md:text-6xl lg:text-8xl">
      a frontend <code class="font-thin">&lt;developer/&gt;</code>
    </h1>
  </div>
</template>
