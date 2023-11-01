<template>
  <section :class="`profile__section profile__portfolio collapse ${showPortfolio ? 'show' : ''}`">
    <div id='portfolio-container' class='container'>
      <button id='toggle-portfolio' type='button' aria-label='Expand portfolio'
              @click='showPortfolio = !showPortfolio' class='btn btn-link section__heading-1'>Collection
      </button>
      <div class='profile__section--content'>
        <ul class='profile__portfolio--items list-unstyled' ref='portfolioContainer'>
          <li v-if='collection' v-for='(item, id) in currentPageCollection'
              :class='`profile__portfolio--item portfolio-item--${item.image_type}`'
              :style="'background-image: url(' + item.image_url + ')' ">
            <button type='button' id='open-nft-modal'
                    :class="`btn profile__portfolio--button ${item.image_type === 'audio' ?? 'play-btn'}`"
                    data-nft-index=''
                    @click='openModal(item)'>
              <span class='profile__portfolio--item-name'>{{ item.name }}</span>
              <span style='color: white'>{{ item.chain }}</span>
            </button>
          </li>
        </ul>

        <div id='portfolio-pagination' style='padding-bottom: 1rem'>
          <div :class="`portfolio-pagination ${pagination.totalNumPages < 5 ? 'portfolio-pagination__centered': ''}`">
            <div v-if='pagination.totalNumPages > 1' class='portfolio-pagination--control'>
              <button type='button' class='btn-nft-pagination btn-nft-pagination--previous'
                      :disabled='pagination.previousPage < 1'
                      @click='setPage(pagination.previousPage)'
              >
              </button>
              <button type='button' :class="`btn-nft-pagination ${pagination.currentPage === 1 ? 'current-page' : ''}`"
                      :disabled='pagination.currentPage === 1'
                      @click='setPage(1)'
              >
                <span class='page-label'>Page </span>1<span class='of-pages'> of {{ pagination.totalNumPages }}</span>
              </button>
              <div v-if='pagination.totalNumPages > 5' style='display: inline'>
                <span v-if='pagination.currentPage > 3' class='ellipsis--pagination'>...</span>
                <button v-for='index in (pagination.endMiddle - pagination.startMiddle + 1)' type='button'
                        :class="`btn-nft-pagination ${index + pagination.startMiddle - 1 === pagination.currentPage ? 'current-page' : ''}`"
                        :disabled='index + pagination.startMiddle - 1 === pagination.currentPage'
                        @click='setPage(index + pagination.startMiddle - 1)'
                >
              <span
                class='page-label'>Page </span>{{ index + pagination.startMiddle - 1 }}<span
                  class='of-pages'> of {{ pagination.totalNumPages }}</span></button>
                <span v-if='pagination.currentPage < pagination.totalNumPages - 2'
                      class='ellipsis--pagination'>...</span>
              </div>
              <div v-else style='display: inline'>
                <button v-for='index in (pagination.totalNumPages - 2)' type='button'
                        :class="`btn-nft-pagination ${pagination.currentPage === index + 1 ? 'current-page' : ''}`"
                        :disabled='index + 1 === pagination.currentPage'
                        @click='setPage(index + 1)'
                >
                  <span class='page-label'>Page </span>{{ index + 1 }}
                  <span class='of-pages'> of {{ pagination.totalNumPages }}</span>
                </button>
              </div>

              <button v-if='pagination.currentPage <= pagination.totalNumPages' type='button'
                      :class="`btn-nft-pagination ${pagination.currentPage === pagination.totalNumPages ? 'current-page' : ''}`"
                      :disabled='pagination.currentPage === pagination.totalNumPages'
                      @click='setPage(pagination.totalNumPages)'
              >
                <span class='page-label'>Page </span>{{ pagination.totalNumPages }}
                <span class='of-pages'> of {{ pagination.totalNumPages }}</span>
              </button>
              <button type='button' class='btn-nft-pagination btn-nft-pagination--next'
                      :disabled='pagination.nextPage < 1'
                      @click='setPage(pagination.nextPage)'
              >
              </button>
            </div>
          </div>
        </div>

        <div id='nft-modal-container' @click='closeModal()'
             :class="`nft-modal__container ${showModel ? 'visible' : 'invisible'} `">
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
                <div v-if='selectedNft.image_type === "video"' style='height: auto; width: auto; overflow-x: visible'
                     class='nft-modal__video-container'>
                  <div class='video__background'>
                    <div class='video__foreground'>
                      <video controls autoplay playsinline controlslist='nodownload'
                             style='height: auto'
                      >
                        <source :src='selectedNft.animation_url' type='video/mp4'>
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                </div>
                <div v-else-if='selectedNft.image_type === "audio"'>
                  <img :src='selectedNft.image_url' class='nft-modal__image' />
                  <audio controls autoplay>
                    <source :src='selectedNft.animation_url' type='audio/mpeg'>
                    Your browser does not support the audio element.
                  </audio>
                </div>
                <model-viewer v-else-if='selectedNft.image_type === "3d"' alt='' :src='selectedNft.animation_url'
                              class='image-3d__model-viewer' auto-rotate='true' auto-play='true' camera-controls='true'
                              ar-status='not-presenting'></model-viewer>
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
                <p>
                  <a
                    :href='`https://opensea.io/assets/${selectedNft.chain}/${selectedNft.asset_contract}/${selectedNft.id}`'
                    target='_blank' rel='noopener noreferrer' class='link__external'>View on OpenSea
                    <svg class='fa-icon'>
                      <use xlink:href='/static-assets/img/fa-sprite.svg#external-link-alt'></use>
                    </svg>
                  </a>
                </p>
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
      </div>
    </div>
  </section>
</template>

<script>

import axios from 'axios'
import ipfsMixin from '../../../mixins/ipfsMixin'

export default {
  mixins: [ipfsMixin],
  data() {
    return {
      collection: [],
      currentPageCollection: [],
      selectedNft: null,
      selectedNftMetadata: null,
      domain: null,
      showModel: false,
      showPortfolio: false,
      pagination: {
        currentPage: 1,
        totalNumPages: 1,
        previousPage: 0,
        nextPage: 0,
        startMiddle: 2,
        endMiddle: 4,
        start: 1,
        end: 48,
        numVisible: 48,
        totalNumRecords: 0,
      },
      itemsPerPage: 48,
    }
  },
  mounted() {
    // get local storage var wallet
    this.domain = localStorage.getItem('domain')
    this.getCollection()
  },
  methods: {
    setPage(page) {
      this.pagination.currentPage = page
      this.setCurrentPageCollection()
      this.calculatePagination(page)
      // scroll to top of container
      this.$refs.portfolioContainer.scrollIntoView({ behavior: 'smooth' })

    },
    setCurrentPageCollection() {
      let startNum = this.pagination.currentPage === 1 ? 0 : ((this.pagination.currentPage - 1) * this.itemsPerPage)
      let endNum = this.pagination.currentPage === 1 ? this.itemsPerPage : ((this.pagination.currentPage) * this.itemsPerPage)
      this.currentPageCollection = this.collection.slice(startNum, endNum)
    },
    calculatePagination(page = 1) {
      let totalNumRecords = this.collection.length

      let numRecordsVisible = this.itemsPerPage
      let totalNumPages = Math.ceil(totalNumRecords / numRecordsVisible)
      let currentPage = page
      let paginationStart = ((currentPage - 1) * numRecordsVisible) + 1
      let paginationEnd = paginationStart + numRecordsVisible - 1
      let previousPage = currentPage - 1
      let nextPage = (currentPage + 1 <= totalNumPages) ? currentPage + 1 : 0

      this.pagination.numVisible = numRecordsVisible
      this.pagination.start = paginationStart
      this.pagination.end = (paginationEnd >= totalNumRecords) ? totalNumRecords : paginationEnd
      this.pagination.currentPage = currentPage
      this.pagination.previousPage = previousPage
      this.pagination.nextPage = nextPage
      this.pagination.totalNumRecords = totalNumRecords
      this.pagination.totalNumPages = totalNumPages
      if (currentPage <= 3) {
        this.pagination.startMiddle = 2
        this.pagination.endMiddle = 3
      } else if (currentPage > (totalNumPages - 3)) {
        this.pagination.startMiddle = totalNumPages - 2
        this.pagination.endMiddle = totalNumPages - 1
      } else {
        this.pagination.startMiddle = currentPage - 1
        this.pagination.endMiddle = currentPage + 1
      }
    },
    openModal(item) {
      this.selectedNft = item
      this.getMetadata()
      this.showModel = true
      this.$nextTick(() => {
        this.$refs.nftModal.focus()
      })
    },
    closeModal() {
      this.showModel = false
      this.selectedNft = null
    },
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

      if (image_url !== null && (image_url.slice(-4) === '.glb' || image_url.slice(-5) === '.gltf')) {
        imageType = '3d'
      } else if (
        image_url !== null &&
        (image_url.slice(-4) === '.mp4' || image_url.slice(-4) === '.mov')
      ) {
        imageType = 'video'
      } else if (image_url !== null && (image_url.slice(-4) === '.mp3' || image_url.slice(-4) === '.wav')) {
        imageType = 'audio'
      } else {
        this.IMAGE_EXTENSIONS.forEach((source, index) => {
          if (image_url && image_url.includes(source)) {
            imageType = 'image'
          }
        })
      }
      return imageType
    },
    getMetadata() {
      if (!this.selectedNft || !this.selectedNft.metadata_url) {
        this.selectedNftMetadata = null
        return null
      }
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
                image_type: imageType,
              }
              this.selectedNft = {
                ...this.selectedNft,
                image_type: imageType,
                animation_url: animationUrl,
              }
              break
            }
          }

          if (response.data.data && response.data.data.image) {
            let imageUrl = this.getIpfsUrl(response.data.data.image)
            imageType = this.getImageType(imageUrl)

            this.selectedNftMetadata = {
              ...response.data,
              image_type: imageType,
            }

            this.selectedNft = {
              ...this.selectedNft,
              image_type: imageType,
              image_url: imageUrl,
            }
          }
        })
        .catch(error => {
          console.log(error)
        })
    },
    getCollection() {
      axios.get('/api/collection/' + this.domain)
        .then(response => {
          this.collection = response.data.data

          // open accordion if there are items in the collection
          this.showPortfolio = response.data.data.length > 0

          this.setCurrentPageCollection()
          this.calculatePagination()
        })
        .catch(error => {
          console.log(error)
        })
    },
  },
}
</script>
<style scoped>
</style>
