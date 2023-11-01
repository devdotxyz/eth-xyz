<template>
  <h1>Testing 123</h1>
</template>

<script>

import axios from "axios";

export default {
  props: ['wallet'],
  data(){

  },
  mounted() {
      this.getCollection();
      console.log('this.wallet', this.wallet);
    },
  methods: {
    getCollection() {
      axios.get('/api/collection')
        .then(response => {
          this.collection = response.data;
        })
        .catch(error => {
          console.log(error);
        });
    }
  },
}
</script>
