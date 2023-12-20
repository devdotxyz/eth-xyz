<template>
  <div id='nft-modal-container' @click='closeModal()'
       :class="`nft-modal__container ${visible ? 'visible' : 'invisible'} `">
    <div v-if='selectedNft' class='nft-modal' id='nft-modal' role='dialog' aria-hidden='true'>
      <div tabindex='0' ref='nftModal' @click.stop='' @keydown.esc='closeModal()' class='nft-modal__main'>
        <div class='nft-modal__header'>
          <h3 class='nft-modal__name'>{{ selectedNft.name }}</h3>
          <button type='button' class='btn btn__modal-close' @click='closeModal()'>
            <svg class='fa-icon'>
              <use xlink:href='/static-assets/img/fa-sprite.svg#times'></use>
            </svg>
          </button>
        </div>
        <div id='nft-modal-image-container' class='nft-modal__image-container'>
          <div v-if='selectedNftMetadata && selectedNftMetadata.image_type === "video"'
               style='height: auto; width: auto; overflow-x: visible'
               class='nft-modal__video-container'>
            <div class='video__background'>
              <div class='video__foreground'>
                <video controls autoplay playsinline controlslist='nodownload'
                       style='height: auto'
                >
                  <source :src='selectedNftMetadata.animation_url' type='video/mp4'>
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          </div>
          <div v-else-if='selectedNftMetadata &&selectedNftMetadata.image_type === "audio"'>
            <img :src='selectedNftMetadata.image_url' class='nft-modal__image' />
            <audio controls autoplay>
              <source :src='selectedNftMetadata.animation_url' type='audio/mpeg'>
              Your browser does not support the audio element.
            </audio>
          </div>
          <model-viewer v-else-if='selectedNftMetadata && selectedNftMetadata.image_type === "3d"' alt=''
                        :src='selectedNftMetadata.animation_url'
                        class='image-3d__model-viewer' auto-rotate='true' auto-play='true' camera-controls='true'
                        ar-status='not-presenting'>
          </model-viewer>
          <p v-else-if='!selectedNft.image_url'>Resource not available.</p>
          <img v-else :src='selectedNft.image_url' class='nft-modal__image' />
        </div>
        <div class='nft-modal__text'>
          <div class='nft-modal__description'>
            <h4 class='nft-modal__heading-1'>Description</h4>
            <p class='nft-modal__description--text'>{{ selectedNft.description }}</p>
            <h4 class='nft-modal__heading-1'>Chain</h4>
            <p class='nft-modal__description--text'>{{ selectedNft.chain }}</p>
          </div>
          <div>
            <div v-if='selectedNftMetadata && selectedNftMetadata.created_by' class='nft-modal__creator'>
                <span v-if='selectedNft.created_by_avatar' class='nft-modal__creator-avatar'>
                  <img :src='selectedNft.created_by_avatar' class='nft-modal__creator-avatar--image' /></span>
              <div class='nft-modal__creator-info'>
                <h5 class='nft-modal__heading-2'>Created By</h5>
                <div class='nft-modal__creator-username'>
                  <p>{{ selectedNftMetadata.created_by }}</p>
                </div>
              </div>
            </div>
            <div v-if='selectedNft.collection'>
              <h4 class='nft-modal__heading-1'>Collection</h4>
              <p class='nft-modal__description--text'>{{ selectedNft.collection }}</p>
            </div>
            <p>
              <a
                :href='selectedNft.opensea_url'
                target='_blank' rel='noopener noreferrer' class='link__external'>View on OpenSea
                <svg class='fa-icon'>
                  <use xlink:href='/static-assets/img/fa-sprite.svg#external-link-alt'></use>
                </svg>
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
    <button type='button' class='btn btn__modal-go-back' @click='closeModal()'>
      <svg class='fa-icon'>
        <use xlink:href='/static-assets/img/fa-sprite.svg#chevron-left'></use>
      </svg>
      <span
        class='btn__modal-go-back__label'>go back</span></button>
  </div>
</template>

<script>
import axios from 'axios'
import useEventsBus from '../eventBus'
import ipfsMixin from '../mixins/ipfsMixin'
import imageMixin from '../mixins/imageMixin'
import Loader from './Loader.vue'

export default {
  components: { Loader },

  props: ['visible', 'selectedNft'],
  mixins: [ipfsMixin, imageMixin],

  data() {
    return {
      selectedNftMetadata: this.selectedNft,
    }
  },
  mounted() {
  },
  watch: {
    visible: function() {
      if (this.visible) {
        this.$nextTick(() => {
          this.$refs.nftModal.focus()
        })
        this.getMetadata()
      }
    },
  },
  methods: {
    closeModal() {
      const { emit } = useEventsBus()
      emit('nftModalClosed')
      this.selectedNftMetadata = null
    },
    getMetadata() {
      if (!this.selectedNft || !this.selectedNft.metadata_url) {
        this.selectedNftMetadata = null
        return null
      }
      this.selectedNftMetadata = this.selectedNft
      axios.post('/api/metadata',
        {
          url: this.selectedNft.metadata_url,
        })
        .then(response => {
          if (!response.data) {
            this.selectedNftMetadata = null
            return null
          }
          let imageType = 'image'

          let metadataVars = [
            'animation_url',
            'image',
          ]

          // find the first url that exists in the metadata
          for (let i = 0; i < metadataVars.length; i++) {
            if (response.data.data && response.data.data[metadataVars[i]]) {
              let animationUrl = this.getIpfsUrl(response.data.data[metadataVars[i]])

              imageType = this.getImageType(animationUrl)
              this.selectedNftMetadata = {
                ...response.data,
                image_url: this.selectedNft.image_url,
                image_type: imageType,
                animation_url: animationUrl,
              }
              break
            }
          }
        })
        .catch(error => {
          console.log(error)
        })
    },
  },
}
</script>
<style>
#lazy-load-poster {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
</style>
