<template>
  <section :class="`profile__section profile__portfolio collapse ${showPortfolio ? 'show' : ''}`">
    <div id='portfolio-container' class='container'>
      <button id='toggle-portfolio' type='button' aria-label='Expand portfolio'
              @click='showPortfolio = !showPortfolio' class='btn btn-link section__heading-1'>Collection
      </button>
      <Loader :visible='loading' />
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
              <span v-if='devMode' class='profile__portfolio--item-chain'>{{ item.chain }}</span>
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
      </div>
      <hr  class="section__divider"/>
    </div>
    <NftModal :visible='showModel' :selectedNft='selectedNft' />
  </section>
</template>

<script>

import axios from 'axios'
import Loader from '../../../atoms/Loader.vue'
import NftModal from '../../../atoms/NftModal.vue'
import useEventsBus from '../../../eventBus'
import { watch } from 'vue'
import devModeMixin from '../../../mixins/devModeMixin'

export default {
  components: { NftModal, Loader },
  mixins: [devModeMixin],
  data() {
    return {
      loading: true,
      collection: [],
      currentPageCollection: [],
      selectedNft: null,
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

    // catch emit
    const { bus } = useEventsBus()
    watch(()=>bus.value.get('nftModalClosed'), () => {
      this.showModel = false
      this.selectedNft = null
    })
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
      this.showModel = true
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
        .finally(() => {
          this.loading = false
        })
    },
  },
}
</script>
