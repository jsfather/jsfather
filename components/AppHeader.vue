<script lang="ts" setup>
const themeStore = useThemeStore();
</script>

<template>
  <nav class="flex h-[90px] flex-row items-center text-white">
    <Icon
      v-if="themeStore.selectedTheme?.name === 'javascript'"
      class="h-[69px] w-[40px] cursor-pointer"
      :class="`text-${themeStore.selectedTheme.color}`"
      name="hugeicons:java-script"
      @click="themeStore.setSelectedTheme('jupiter')"
    />
    <Icon
      v-if="themeStore.selectedTheme?.name === 'jupiter'"
      class="h-[69px] w-[40px] cursor-pointer"
      :class="`text-${themeStore.selectedTheme.color}`"
      name="hugeicons:jupiter"
      @click="themeStore.setSelectedTheme('javascript')"
    />
    <NuxtLink to="/">
      <h1 class="mx-1 text-3xl font-bold">
        {{
          themeStore.selectedTheme?.name === 'jupiter' ? `'s father` : 'father'
        }}
      </h1></NuxtLink
    >
    <NuxtLink
      href="https://github.com/jsfather"
      target="_blank"
      class="ml-auto"
    >
      <Icon class="h-[40px] w-[40px]" name="mdi-github" />
    </NuxtLink>
  </nav>
</template>

<style scoped></style>
