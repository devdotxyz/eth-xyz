export default {
  data() {
    return {
      devMode: false,
    }
  },
  mounted() {
    this.devMode = localStorage.getItem('dev') === 'true'
  },
}
