let IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.gif', '.png', '.svg']
export default {
  methods: {
    getImageType(image_url) {
      let imageType = 'image'
      const nftSources = [
        'artblocks.io',
        'arweave.net',
        'ethblock.art',
        'ether.cards',
        'etherheads.io',
        'ethouses.io',
        'everyicon.xyz',
        'pinata.cloud',
        'ipfs.io',
        'stickynft.com',
        'vxviewer.vercel.app',
      ]
      nftSources.forEach((source, index) => {
        if (image_url && image_url.includes(source)) {
          imageType = 'nonstandard'
        }
      })

      if (
        image_url !== null &&
        (image_url.slice(-4) === '.glb' || image_url.slice(-5) === '.gltf')
      ) {
        imageType = '3d'
      } else if (
        image_url !== null &&
        (image_url.slice(-4) === '.mp4' || image_url.slice(-4) === '.mov')
      ) {
        imageType = 'video'
      } else if (
        image_url !== null &&
        (image_url.slice(-4) === '.mp3' || image_url.slice(-4) === '.wav')
      ) {
        imageType = 'audio'
      } else {
        IMAGE_EXTENSIONS.forEach((source, index) => {
          if (image_url && image_url.includes(source)) {
            imageType = 'image'
          }
        })
      }
      return imageType
    },
  },
}
