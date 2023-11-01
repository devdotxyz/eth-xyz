<template>
  <div v-if='visible' class='loading__indicator'>
    <div class='loading__text'>Loading</div>
  </div>
</template>

<script>
export default {
  props: ['visible'],
}
</script>
