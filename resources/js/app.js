import '../css/app.css'
import { createApp, h } from 'vue'
import CollectionContainer from './vue/components/profile/collection/CollectionContainer.vue'
import components from './vue/components'

createApp({
  components: components,
  render: () => h(CollectionContainer, {}),
}).mount('#vue-collection')
