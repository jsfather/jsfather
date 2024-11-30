<script setup lang="ts">
defineProps({
  title: String,
  descriptions: String,
});
</script>

<template>
  <div>
    <div class="text-2xl font-bold text-white">{{ title }}</div>
    <div class="mt-4 text-gray-300">{{ descriptions }}</div>
  </div>
</template>

<style scoped></style>
