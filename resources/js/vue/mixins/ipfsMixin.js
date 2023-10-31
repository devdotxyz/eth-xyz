export default {
  methods: {
    getIpfsUrl(ipfs) {
      let url = ipfs
      if (url.slice(0, 7) === 'ipfs://') {
        // remove ipfs from the url
        url = url.slice(7)
        url = 'https://ipfs.io/ipfs/' + url
      }
      console.log('ipfs url', url)
      return url
    },
  },
}
