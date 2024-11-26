<script lang="ts" setup>
const themeStore = useThemeStore();

const menuItems = ref([
  {
    title: 'design',
    path: '/design',
  },
  {
    title: 'development',
    path: '/development',
  },
  {
    title: 'blog',
    path: '/blog',
  },
  {
    title: 'cv',
    path: '/cv',
  },
]);
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
    <div class="ml-auto flex flex-row items-center">
      <NuxtLink
        v-for="menuItem in menuItems"
        :key="menuItem.path"
        :to="menuItem.path"
        :active-class="`line-through text-white decoration-${themeStore.selectedTheme?.color}`"
        class="mx-4 text-xl font-thin text-gray-200"
        >{{ menuItem.title }}
      </NuxtLink>
      <NuxtLink href="https://github.com/jsfather" target="_blank" class="ml-4">
        <Icon
          class="h-[40px] w-[40px]"
          :class="`hover:text-${themeStore.selectedTheme?.color}`"
          name="mdi-github"
        />
      </NuxtLink>
    </div>
  </nav>
</template>

<style scoped></style>
