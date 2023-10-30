<template>
  <div>
    <ul class='profile__portfolio--items list-unstyled'>
      <li v-if='collection' v-for='(item, id) in currentPageCollection'
          :class='`profile__portfolio--item portfolio-item--${item.image_type}`'
          :style="'background-image: url(' + item.image_url + ')' ">
        <button type='button' id='open-nft-modal'
                :class="`btn profile__portfolio--button ${item.image_type === 'audio' ?? 'play-btn'}`" data-nft-index=''
                @click='openModal(item)'>
          <span class='profile__portfolio--item-name'>{{ item.name }}</span>
          <span style='color: white'>{{ item.chain }}</span>
          <!--      <% if (image_type === '3d') { %>-->
          <!--      <div class="portfolio-image-3d__thumbnail">-->
          <!--        <model-viewer alt="" src="" class="portfolio-image-3d__model-viewer" auto-rotate="true" auto-play="true" camera-controls="true" ar-status="not-presenting"></model-viewer>-->
          <!--      </div>-->
          <!--      <% } else if (image_type === 'video') { %>-->
          <!--      <div class="portfolio-thumbnail__video-container" style="padding-bottom: 100%;">-->
          <!--        <div class="video__background">-->
          <!--          <div class="video__foreground">-->
          <!--            <video autoPlay muted playsInline loop controlsList="nodownload">-->
          <!--              <source src="<%= media_url %>" type="video/mp4">-->
          <!--              Your browser does not support the video tag.-->
          <!--            </video>-->
          <!--          </div>-->
          <!--        </div>-->
          <!--      </div>-->
          <!--      <% } %>-->
        </button>
      </li>
    </ul>

    <div id='nft-modal-container' :class="`nft-modal__container ${showModel ? 'visible' : 'invisible'} `">
      <div v-if='selectedNft' class='nft-modal' id='nft-modal' role='dialog' aria-hidden='true'>
        <div class='nft-modal__main'>
          <div class='nft-modal__header'>
            <h3 class='nft-modal__name'>{{ selectedNft.name }}</h3>
            <button type='button' class='btn btn__modal-close' @click='closeModal()'>
              <svg class='fa-icon'>
                <use xlink:href='/static-assets/img/fa-sprite.svg#times'></use>
              </svg>
            </button>
          </div>
          <div id='nft-modal-image-container' class='nft-modal__image-container loading'>
            <div v-if='selectedNft.image_type === "video"' class='nft-modal__video-container'>
              <div class='video__background'>
                <div class='video__foreground'>
                  <video controls autoplay playsinline controlslist='nodownload'>
                    <source :src='selectedNft.image_url' type='video/mp4'>
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
            <div v-else-if='selectedNft.image_type === "audio"'>
              <img :src='selectedNft.image_url' class='nft-modal__image' />
              <audio controls autoplay>
                <source :src='selectedNft.image_url' type='audio/mpeg'>
                Your browser does not support the audio element.
              </audio>
            </div>

            <!--          <model-viewer v-else-if='selectedNft.image_type === "3d"' alt="" :src="selectedNft.image_url" class="image-3d__model-viewer" auto-rotate="true" auto-play="true" camera-controls="true" ar-status="not-presenting"></model-viewer>-->
            <img v-else :src='selectedNft.image_url' class='nft-modal__image' />
          </div>
          <div class='nft-modal__text'>
            <div class='nft-modal__description'>
              <h4 class='nft-modal__heading-1'>Description</h4>
              <p class='nft-modal__description--text'>{{ selectedNft.description }}</p>
            </div>
            <div class='nft-modal__credits'>
              <div v-if='selectedNft.created_by' class='nft-modal__creator'>
                <span v-if='selectedNft.created_by_avatar' class='nft-modal__creator-avatar'><img src=''
                                                                                                  class='nft-modal__creator-avatar--image' /></span>
                <div class='nft-modal__creator-info'>
                  <h5 class='nft-modal__heading-2'>Created By</h5>
                  <div class='nft-modal__creator-username'>
                    <p>{{ selectedNft.created_by }}</p>
                  </div>
                </div>
              </div>
              <p><a href='https://google.com' target='_blank' rel='noopener noreferrer' class='link__external'>View on
                OpenSea
                <svg class='fa-icon'>
                  <use xlink:href='/static-assets/img/fa-sprite.svg#external-link-alt'></use>
                </svg>
              </a></p>
            </div>
          </div>
        </div>
        <button type='button' class='btn btn__modal-go-back' onclick='window.ethxyz.loader.closeNftModal()'>
          <svg class='fa-icon'>
            <use xlink:href='/static-assets/img/fa-sprite.svg#chevron-left'></use>
          </svg>
          <span
            class='btn__modal-go-back__label'>go back</span></button>
      </div>
    </div>

    <div id='portfolio-pagination'>
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
          <div v-if='pagination.totalNumPages > 5' style="display: inline">
            <span v-if='pagination.currentPage > 3' class='ellipsis--pagination'>...</span>
            <button v-for='index in (pagination.endMiddle - pagination.startMiddle + 1)' type='button'
                    :class="`btn-nft-pagination ${index + pagination.startMiddle - 1 === pagination.currentPage ? 'current-page' : ''}`"
                    :disabled='index + pagination.startMiddle - 1 === pagination.currentPage'
                    @click='setPage(index + pagination.startMiddle - 1)'
            >
              <span
                class='page-label'>Page </span>{{ index + pagination.startMiddle - 1 }}<span
                class='of-pages'> of {{ pagination.totalNumPages }}</span></button>
            <span v-if='pagination.currentPage < pagination.totalNumPages - 2' class='ellipsis--pagination'>...</span>
          </div>
          <div v-else style="display: inline">
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

  </div>
</template>

<script>

import axios from 'axios'

export default {
  data() {
    return {
      collection: [],
      currentPageCollection: [],
      selectedNft: null,
      selectedNftMetadata: null,
      domain: null,
      showModel: false,
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
  computed: {
    // currentPageCollection: {
    //   get: function () {
    //
    //     // return only 48 items from current page
    //     console.log('calculated', this.collection.slice(this.pagination.currentPage * 48, (this.pagination.currentPage + 1) * 48));
    //     return this.collection.slice(this.pagination.currentPage * 48, (this.pagination.currentPage + 1) * 48)
    //
    //   }
    // },
  },
  mounted() {
    // get local storage var wallet
    this.domain = localStorage.getItem('domain')
    this.getCollection()
    console.log('length', this.collection.length)
    // get wallet from url,
    // get nfts based on wallet
    console.log('this.domain', this.domain)
  },
  methods: {
    setPage(page) {
      console.log('page', page)
      this.pagination.currentPage = page
      this.setCurrentPageCollection()
      this.calculatePagination(page)

      console.log('pagination', this.pagination)
    },
    setCurrentPageCollection() {
      console.log('calculating length 2', this.collection)
      console.log('calculating length 2', this.collection.length)

      let startNum = this.pagination.currentPage === 1 ? 0 : ((this.pagination.currentPage - 1) * this.itemsPerPage)
      let endNum = this.pagination.currentPage === 1 ? this.itemsPerPage : ((this.pagination.currentPage) * this.itemsPerPage)
      this.currentPageCollection = this.collection.slice(startNum, endNum)
      console.log('current page collection', this.currentPageCollection)

      console.log('start', startNum);
      console.log('endNum', endNum);
    },
    calculatePagination(page = 1) {
      console.log('calculating length 1')
      let totalNumRecords = this.collection.length
      console.log('done calculating length 1')

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

      // let p = 1
      // let item = 0
      // this.data.visibleNfts = []
      //
      // this.data.nfts.forEach((nft, index) => {
      //   if (p === currentPage) {
      //     this.data.visibleNfts.push(nft)
      //   }
      //   item++
      //
      //   if (item === this.data.nftsPagination.numVisible) {
      //     item = 0
      //     p++
      //   }
      // })
    },
    openModal(item) {
      this.selectedNft = item
      this.showModel = true
      console.log('openModel')
    },
    closeModal() {
      this.selectedNft = null
      this.showModel = false
      console.log('closeModal')
    },
    getCollection() {
      axios.get('/api/collection/' + this.domain)
        .then(response => {
          console.log('got response');
          this.collection = response.data.data
          console.log('set response', this.collection.length);

          this.setCurrentPageCollection()
          console.log('set collection page');

          this.calculatePagination()
          console.log('calculagte pagination');

        })
        .catch(error => {
          console.log(error)
        })
    },
  },
}
</script>
