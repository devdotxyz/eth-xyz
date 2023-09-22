const textRecordKeys = [
  'avatar',
  'description',
  'display',
  'email',
  'keywords',
  'mail',
  'notice',
  'location',
  'phone',
  'url',
  'com.github',
  'com.peepeth',
  'com.linkedin',
  'com.twitter',
  'com.discord',
  'com.reddit',
  'io.keybase',
  'org.telegram',
  '_atproto',
  '_atproto.',
  'contentHash',
  'provider_error',
  'bluesky_error',
  'wallets'
];

class EthXyzLoader {  

  constructor(domain, isLogging) {
    this.data = {
      isLogging: false,
      isFullyLoaded: false,
      domain: '',
      textRecords: {},
      nfts: [],
      nftsPagination: {},
      visibleNfts: [],
    }

    this.templates = {
      profile: _.template(document.getElementById('template-profile').innerHTML),
      avatar: _.template(document.getElementById('template-avatar').innerHTML),
      portfolioEntry: _.template(document.getElementById('template-portfolio-entry').innerHTML),
      nftPagination: _.template(document.getElementById('template-nft-pagination').innerHTML),
      nftModal: _.template(document.getElementById('template-nft-modal').innerHTML),
      walletEntry: _.template(document.getElementById('template-wallet-entry').innerHTML),
    }

    this.els = {
      containers: {
        main: document.querySelector('main'),
        loading: document.getElementById('loading-container'),
        profile: document.getElementById('profile-container'),
        profileEntry: document.getElementById('profile-entry-container'),
        avatar: document.getElementById('avatar-container'),
        portfolioEntry: document.getElementById('portfolio-entry-container'),
        portfolioPagination: document.getElementById('portfolio-pagination'),
        portfolio: document.getElementById('portfolio-container'),
        nftModal: document.getElementById('nft-modal-container'),
        wallets: document.getElementById('wallets-container'),
        walletsEntry: document.getElementById('wallets-entry-container'),
        notification: document.getElementById('notification-container'),
        notificationBluesky: document.getElementById('bluesky-notification-container'),
      },
      toggles: {
        profile: document.getElementById('toggle-profile'),
        portfolio: document.getElementById('toggle-portfolio'),
        wallets: document.getElementById('toggle-wallets'),
      },
    }

    this.imageExtensions = ['.jpg','.jpeg','.gif','.png','.svg'];
    this.videoExtensions = ['.mp4','.mov'];
    this.audioExtensions = ['.mp3'];

    // Set Initial Data
    this.data.isLogging = isLogging
    this.data.domain = domain
    this.data.fetchError = false
    this.data.fetchErrorBlueSky = false

    this.log(`Domain is ${domain}`)

    // Load additional data
    this.getTextRecords()
      .then((textRecords) => {
        if (typeof textRecords === 'object') {
          this.data.textRecords = textRecords
        }
        // trigger fetch error if success is false
        textRecords && textRecords.success === false ? (this.data.fetchError = true) : null
        textRecords && textRecords.provider_error === true ? (this.data.fetchError = true) : null
        textRecords && textRecords.bluesky_error ? (this.data.fetchErrorBlueSky = true) : null
        
        this.data.fetchError === true ? this.els.containers.notification.classList.remove('hide') : null
        this.data.fetchErrorBlueSky === true ? this.els.containers.notificationBluesky.classList.remove('hide') : null
        

        this.getAvatar(domain).then((avatarImg) => {
            let avatarContainer = this.els.containers.avatar
            let image = avatarContainer.querySelector('img')
            let isLoaded = avatarImg.complete && avatarImg.naturalHeight !== 0
            if (!isLoaded) {
              avatarContainer.classList.add('profile__avatar--bg')
            } else {
              avatarContainer.classList.remove('profile__avatar--bg')
              image.classList.remove('hide')
              image.classList.add('profile__avatar--image-bg')
            }
          })
          .catch((e) => {
            this.log('failed to fetch avatar')
          })
        this.getNfts().then((nfts) => {
          if (Array.isArray(nfts)) {
            this.data.nfts = nfts
            this.goToPage(1)
          }
          this.render()
        })
      })
      .catch((e) => {
        this.data.fetchError = true
        e === 'No text records found.' ? (window.location.href = '/404') : null
      })
  }

  getTextRecord(record) {
    if (typeof this.data.textRecords[record] !== 'undefined') {
      let textRecord = this.data.textRecords[record]
      let sanitizedTextRecord = this.sanitizeTextRecord(record, textRecord)
      return sanitizedTextRecord
    } else {
      return null
    }
  }

  getCustomTextRecord() {
    let customTextRecords = [];

    Object.keys(this.data.textRecords).forEach((key) => {
      // if textRecord.key is not in textRecordKeys
      if (textRecordKeys.indexOf(key) === -1) {
        const record = {};
        record['key'] = key; 
        record['value'] = this.sanitizeTextRecord(key, this.data.textRecords[key]);
        customTextRecords.push(record) 
      }
    })

    return customTextRecords;
  }

  sanitizeTextRecord(record, textRecord) {
    if (textRecord !== null) {
      if (record === 'com.twitter') {
        textRecord = textRecord.split("twitter.com/").pop()
        textRecord = textRecord.split("@").pop()
      } else if (record === 'com.github') {
        textRecord = textRecord.split("github.com/").pop()
      } else if (record === 'com.linkedin') {
        textRecord = textRecord.split("linkedin.com/").pop()
      } else if (record === 'com.peepeth') {
        textRecord = textRecord.split("peepeth.com/").pop()
      } else if (record === 'org.telegram') {
        textRecord = textRecord.split("t.me/").pop()
      } else if (record === 'io.keybase') {
        textRecord = textRecord.split("keybase.io/").pop()
      } else if (record === 'url') {
        if (textRecord.substring(0, 4) !== 'http') {
          textRecord = 'https://' + textRecord
        }
      } else if (record === '_atproto') {
        textRecord = textRecord.split("did=").pop()
      }
    }
    return textRecord
  }

  getWalletAddress(walletName) {
    if (typeof this.data.textRecords.wallets !== 'undefined') {
      let wallet = this.data.textRecords.wallets.find((wallet) => wallet.name === 'ethereum')
      if (typeof wallet !== 'undefined' && typeof wallet.value === 'string') {
        return wallet.value
      }
    }
    return null
  }

  async getAvatar(domain) {
    const img = new Image()
    img.src = 'https://metadata.ens.domains/mainnet/avatar/' + domain
    let value = await img
      .decode()
      .then(() => {
        return img
      })
      .catch((err) => {
        this.log('Avatar failed to load.')
        throw 'Avatar failed to load.'
      })
    return value
  }

  async getTextRecords() {
    let response = await fetch(`/text-records/${this.data.domain}`)
    response = await response.json()
    if (response.success) {
      this.log('Received text records')
      return response.data
    } else if (!response.success && response.data === null) {
      this.log('No text records found.')
      throw 'No text records found.'
    } else {
      console.log(response)
      return response
    }
  }

  async getNfts() {
    this.log('Getting NFTs')
    let walletAddress = this.getWalletAddress('ethereum')
    // If there is a valid ethereum wallet fetch NFTs
    if (this.getWalletAddress(walletAddress) !== null) {
      let response = await fetch(`/nfts/${walletAddress}`)
      response = await response.json()
      if (response.success) {
        this.log('Received NFTs')
        return response.data
      } else {
        this.log('No NFTs found')
        throw 'No NFTs found'
      }
    } else {
      this.log('No ethereum wallet')
    }
  }

  log(data) {
    if (this.data.isLogging) {
      console.log(data)
    }
  }

  goToPage(page) {
    this.calculatePagination(page)
    this.renderPortfolioPagination()
    this.renderPortfolio()

    if (page === 1) {
      this.els.toggles.portfolio.click()
    }

    const offsetTop = this.els.containers.portfolio.offsetTop;

    scroll({
      top: offsetTop,
      behavior: "smooth"
    });
  }

  calculatePagination(page = 1) {
    let totalNumRecords = this.data.nfts.length
    let numRecordsVisible = 48
    let totalNumPages = Math.ceil(totalNumRecords / numRecordsVisible)
    let currentPage = parseInt(page)
    let paginationStart = ((currentPage - 1) * numRecordsVisible) + 1
    let paginationEnd = paginationStart + numRecordsVisible - 1
    let previousPage = currentPage - 1
    let nextPage = (currentPage + 1 <= totalNumPages) ? currentPage + 1 : 0

    this.data.nftsPagination.numVisible = numRecordsVisible
    this.data.nftsPagination.start = paginationStart
    this.data.nftsPagination.end = (paginationEnd >= totalNumRecords) ? totalNumRecords : paginationEnd
    this.data.nftsPagination.currentPage = currentPage
    this.data.nftsPagination.previousPage = previousPage
    this.data.nftsPagination.nextPage = nextPage
    this.data.nftsPagination.totalNumRecords = totalNumRecords
    this.data.nftsPagination.totalNumPages = totalNumPages
    if (currentPage <= 3) {
      this.data.nftsPagination.startMiddle = 2
      this.data.nftsPagination.endMiddle = 3
    } else if (currentPage > (totalNumPages - 3)) {
      this.data.nftsPagination.startMiddle = totalNumPages - 2
      this.data.nftsPagination.endMiddle = totalNumPages - 1
    } else {
      this.data.nftsPagination.startMiddle = currentPage - 1
      this.data.nftsPagination.endMiddle = currentPage + 1
    }

    let p = 1
    let item = 0
    this.data.visibleNfts = []

    this.data.nfts.forEach((nft, index) => {
      if (p === currentPage) {
        this.data.visibleNfts.push(nft);
      }
      item++

      if (item === this.data.nftsPagination.numVisible) {
        item = 0
        p++
      }
    })
  }

  closeNftModal() {
    this.pauseModalVideo()
    this.pauseModalAudio()
    this.els.containers.nftModal.classList.remove('visible')
    this.els.containers.nftModal.classList.add('invisible')
  }

  // Renders data from AJAX into template
  render() {
    this.renderProfile()
    // this.renderAvatar();
    this.renderWallets()
    this.setIsFullyLoaded(true)
  }

  renderProfile() {
    // TODO: Loop through some k:v list instead of doing these 1-by-1
    let description = this.getTextRecord('description')
    let email = this.getTextRecord('email')
    let github = this.getTextRecord('com.github')
    let keybase = this.getTextRecord('io.keybase')
    let linkedin = this.getTextRecord('com.linkedin')
    let peepeth = this.getTextRecord('com.peepeth')
    let phone = this.getTextRecord('phone')
    let telegram = this.getTextRecord('org.telegram')
    let twitter = this.getTextRecord('com.twitter')
    let discord = this.getTextRecord('com.discord')
    let reddit = this.getTextRecord('com.reddit')
    let url = this.getTextRecord('url')
    let bluesky = this.getTextRecord('_atproto') ?? this.getTextRecord('_atproto.')
    let contentHash = this.getTextRecord('contentHash')
    let contentHashGateway1 = '';
    let contentHashGateway2 = '';
    if (contentHash && contentHash.indexOf('ipfs://') !== -1){
      contentHashGateway1 = this.data.domain + '.limo'
      contentHashGateway2 = this.data.domain + '.link'
    }

    let customTextRecords = this.getCustomTextRecord();

    let blueskyUrl = null;

    if(bluesky) {
      blueskyUrl = bluesky.replace('did=', '')
    }

    if (
      description === null &&
      email === null &&
      github === null &&
      keybase === null &&
      linkedin === null &&
      peepeth === null &&
      phone === null &&
      telegram === null &&
      twitter === null &&
      discord === null &&
      reddit === null &&
      url === null &&
      bluesky === null &&
      contentHash === null && 
      customTextRecords == [] 
    ) {
      this.els.containers.profile.classList.add('hide')
    } else {
      this.els.containers.profileEntry.innerHTML = this.templates.profile({
        description: (description) ? _.escape(description) : null,
        email: (email) ? _.escape(email) : null,
        github: (github) ? _.escape(github) : null,
        keybase: (keybase) ? _.escape(keybase) : null,
        linkedin: (linkedin) ? _.escape(linkedin) : null,
        peepeth: (peepeth) ? _.escape(peepeth) : null,
        phone: (phone) ? _.escape(phone) : null,
        telegram: (telegram) ? _.escape(telegram) : null,
        twitter: (twitter) ? _.escape(twitter) : null,
        discord: (discord) ? _.escape(discord) : null,
        reddit: (reddit) ? _.escape(reddit) : null,
        url: (url) ? _.escape(url) : null,
        bluesky: (bluesky) ? _.escape(bluesky) : null,
        blueskyUrl: (blueskyUrl) ? _.escape(blueskyUrl) : null,
        contentHash: (contentHash) ? _.escape(contentHash) : null,
        contentHashGateway1: (contentHashGateway1) ? _.escape(contentHashGateway1) : null,
        contentHashGateway2: (contentHashGateway2) ? _.escape(contentHashGateway2) : null,
        customTextRecords: customTextRecords,
      })
      this.els.toggles.profile.click()
    }
  }

  renderAvatar() {
    let avatarUrl = 'https://loremflickr.com/281/281/design?lock=9'
    let textRecordAvatar = this.getTextRecord('avatar')
    if (
      textRecordAvatar !== null &&
      textRecordAvatar !== undefined &&
      textRecordAvatar.indexOf('http') !== -1
    ) {
      avatarUrl = textRecordAvatar
    }
    this.els.containers.avatar.innerHTML = this.templates.avatar({
      avatar_url: (avatarUrl) ? _.escape(avatarUrl) : null,
    })
  }

  checkNftImageType(nft) {
    let image_type = 'image'
    const nftSources = ['artblocks.io','arweave.net','ethblock.art','ether.cards','etherheads.io','ethouses.io','everyicon.xyz','pinata.cloud','ipfs.io','stickynft.com','vxviewer.vercel.app']
    nftSources.forEach((source, index) => {
      if (nft.animation_original_url && nft.animation_original_url.includes(source) || nft.animation_url && nft.animation_url.includes(source)) {
        image_type = 'nonstandard'
      }
    })

    if ((nft.animation_original_url !== null && (nft.animation_original_url.slice(-4) ===
      '.glb' || nft.animation_original_url.slice(-5) === '.gltf')) || (nft.animation_url !== null && (nft.animation_url.slice(-4) === '.glb' || nft.animation_url.slice(-5) === '.gltf'))) {
      image_type = '3d'
    } else if ((nft.animation_original_url !== null && (nft.animation_original_url.slice(-4) === '.mp4' || nft.animation_original_url.slice(-4) === '.mov')) || (nft.animation_url !== null && (nft.animation_url.slice(-4) === '.mp4' || nft.animation_url.slice(-4) === '.mov')) || (nft.image_url !== null && (nft.image_url.slice(-4) === '.mp4' || nft.image_url.slice(-4) === '.mov'))) {
      image_type = 'video'
    } else if ((nft.animation_original_url !== null && (nft.animation_original_url.slice(-4) === '.mp3')) || (nft.animation_url !== null && (nft.animation_url.slice(-4) === '.mp3' )) || (nft.image_url !== null && (nft.image_url.slice(-4) === '.mp3'))) {
      image_type = 'audio'
    } else {
      this.imageExtensions.forEach((source, index) => {
        if (nft.animation_original_url && nft.animation_original_url.includes(source) || nft.animation_url && nft.animation_url.includes(source)) {
          image_type = 'image'
        }
      })
    }

    return image_type
  }

  isValidImageFile(url) {
    let valid = false;
    this.imageExtensions.forEach((source, index) => {
      if (url.includes(source)) {
        valid = true;
        return;
      }
    })
    return valid;
  }

  isValidVideoFile(url) {
    let valid = false;
    this.videoExtensions.forEach((source, index) => {
      if (url.includes(source)) {
        valid = true;
        return;
      }
    })
    return valid;
  }

  isValidAudioFile(url) {
    let valid = false;
    this.audioExtensions.forEach((source, index) => {
      if (url.includes(source)) {
        valid = true;
        return;
      }
    })
    return valid;
  }

  renderPortfolioPagination() {
    if (!this.data.visibleNfts.length) {
      this.els.containers.portfolioPagination.classList.add('hide')
    } else {
      let newHtml = ''
      newHtml += this.templates.nftPagination({
        pagination: this.data.nftsPagination,
      })
      this.els.containers.portfolioPagination.innerHTML = newHtml
    }

    let navButtons = this.els.containers.portfolioPagination.querySelectorAll('button')
    navButtons.forEach((navButton) => {
      navButton.addEventListener('click', (e) => {
        this.goToPage(e.target.dataset.page)
      });
    });
  }

  renderPortfolio() {
    this.log('renderPortfolio', this.data.visibleNfts.length)

    if (this.data.fetchErrorBlueSky) {
      this.els.containers.notificationBluesky.classList.remove('hide')
    }

    if (this.data.fetchError) {
      // console.log('fetch error')
      // this.els.containers.notification.innerHTML = '<p>FETCH ERROR</p>'
      this.els.containers.notification.classList.remove('hide')
      this.setIsFullyLoaded(true)
    }
    if (!this.data.visibleNfts.length) {
      this.els.containers.portfolio.classList.add('hide')
    } else {
      let newHtml = '<ul class="profile__portfolio--items list-unstyled">'
      this.data.visibleNfts.forEach((nft, index) => {
        let image_type = this.checkNftImageType(nft)
        let {image_url, media_url} = this.setImageUrl(image_type, nft, true)

        let nft_name = '[Unidentified]'
        if (nft.name) {
          nft_name = nft.name
        } else {
          if (nft.token_id) {
            nft_name = '#' + nft.token_id
          }
        }

        newHtml += this.templates.portfolioEntry({
          index: index,
          image_url: (image_url) ? _.escape(image_url) : null,
          image_preview_url: (nft.image_preview_url) ? _.escape(nft.image_preview_url) : null,
          image_type: image_type,
          media_url:  _.escape(media_url),
          name: (nft_name) ? _.escape(nft_name) : null,
          description: (nft.description) ? _.escape(nft.description) : null,
          url: (nft.permalink) ? _.escape(nft.permalink) : null,
        })
      })

      newHtml += '</ul>'

      this.els.containers.portfolioEntry.innerHTML = newHtml
    }
  }

  renderNftModal(e) {
    let nft = this.data.visibleNfts[e.dataset.nftIndex]
    let creator_username =
      // eslint-disable-next-line eqeqeq
      nft.creator != null && nft.creator.user != null && nft.creator.user.username != null
        ? nft.creator.user.username
        : null
    let creator_avatar =
      nft.creator != null && nft.creator.profile_img_url != null
        ? nft.creator.profile_img_url
        : null

    let image_type = this.checkNftImageType(nft)
    let {image_url, media_url} = this.setImageUrl(image_type, nft)

    let nft_name = '[Unidentified]'
    if (nft.name) {
      nft_name = nft.name
    } else {
      if (nft.token_id) {
        nft_name = '#' + nft.token_id
      }
    }

    let image_preview_url
    if (image_type == 'video') {
      if (nft.image_url) {
        image_preview_url = nft.image_url
      } else if (nft.image_preview_url) {
        image_preview_url = nft.image_preview_url
      }
    }

    this.els.containers.nftModal.innerHTML = this.templates.nftModal({
      image_url: (image_url) ? _.escape(image_url) : null,
      media_url: (media_url) ? _.escape(media_url) : null,
      image_preview_url: (image_preview_url) ? _.escape(image_preview_url) : null,
      image_type: image_type,
      name: (nft_name) ? _.escape(nft_name) : null,
      description: (nft.description) ? _.escape(nft.description) : null,
      creator_username: (creator_username) ? _.escape(creator_username) : null,
      creator_avatar: (creator_avatar) ? _.escape(creator_avatar) : null,
      url: (nft.permalink) ? _.escape(nft.permalink) : null,
    })
    this.els.containers.nftModal.classList.remove('invisible', 'invisible-start')
    this.els.containers.nftModal.classList.add('visible')

    let modalImageContainer = this.els.containers.nftModal.querySelector(
      '#nft-modal-image-container'
    )

    ;(async () => {
      if (image_type === 'video') {
        let videoElement = modalImageContainer.querySelector('video')

        async function getPreviewImage(url) {
          const img = new Image()
          img.src = url
          img.loading = 'lazy'
          let value = await img
            .decode()
            .then(() => {
              return img
            })
            .catch((err) => {
              this.log('NFT image failed to load.')
              throw 'NFT image failed to load.'
            })
          return value
        }

        // Don't do anything until after the videoElement has loaded
        videoElement.addEventListener( "loadedmetadata", function (e) {

          (async () => {

            // The responsiveVideo() function will run on initial page load,
            // then re-run each time the browser window is resized or mobile orientation changes
            function responsiveVideo() {

              let newAspectRatio

              if (videoOriginalHeight === 0) {
                videoWidth = videoPreviewImage.naturalWidth
                videoHeight = videoPreviewImage.naturalHeight
                newAspectRatio = videoHeight / videoWidth
                videoElement.setAttribute('poster', nft.image_url)
              }

              let videoContainer = modalImageContainer.querySelector('.nft-modal__video-container')

              let videoFrameMaxWidth = 630 // Max width of the video frame given the current CSS of the NFT modal
              let videoFrameSideMargins = 60 // Total of the margins on either side of the video frame (for mobile)

              // Reset this each time the function runs
              let windowWidth = window.innerWidth

              // If the video's natural width is greater than or equal to videoFrameMaxWidth,
              // use the full width of the modal, using padding-bottom to set height based on aspect ratio
              if (videoWidth > videoFrameMaxWidth) {
                videoContainer.style.paddingBottom = aspectRatio * 100 + "%"

              // If the video's natural width is less than videoFrameMaxWidth:
              } else {

                // If the window width is greater than or equal to the videoWidth + side margins,
                // set the height to the natural height of the video & remove padding-bottom
                if (windowWidth >= (videoWidth + videoFrameSideMargins)) {
                  videoContainer.style.height = videoHeight + 'px'
                  videoContainer.style.width = 'auto'
                  videoContainer.style.removeProperty('padding-bottom')

                  // If the window width is less than the natural width of the video + side margins,
                  // remove height and use the full width of the modal,
                  // using padding-bottom to set height based on aspect ratio
                } else {
                  if (videoOriginalHeight === 0) {
                    let dynamicWidth = windowWidth - videoFrameSideMargins
                    let newHeight = Math.ceil(dynamicWidth * newAspectRatio)
                    videoContainer.style.height = newHeight + 'px'
                  } else {
                    videoContainer.style.removeProperty('height')
                  }
                  videoContainer.style.paddingBottom = aspectRatio * 100 + "%"
                }
              }
            }

            let videoWidth = videoElement.videoWidth
            let videoHeight = videoElement.videoHeight
            let videoOriginalHeight = videoHeight
            let aspectRatio = videoHeight / videoWidth

            // If the video height is 0, wait until the video preview image has loaded so that
            // the image values can be used in the responsiveVideo function below
            let videoPreviewImage = (videoOriginalHeight === 0) ? await getPreviewImage(nft.image_url) : null

            // Run this function once on initial page load
            responsiveVideo()

            // Then, as the window resizes, run responsiveVideo() each time
            window.addEventListener('resize', function() {
              responsiveVideo()
            }.bind(event))

            // Or when there's an orientation change in mobile, run responsiveVideo() - for iOS Chrome
            window.addEventListener('orientationchange', function() {
              responsiveVideo()
            }.bind(event))
          })()

        })
      } else {
        const img = new Image()
        img.src = image_url
        await img
          .decode()
          .then(() => {
            modalImageContainer.classList.remove('loading')
          })
          .catch((err) => {
            modalImageContainer.classList.remove('loading')
            modalImageContainer.innerText = "Resource not available."
          })
      }
    })()

    function pauseModalVideo() {
      let videoElement = modalImageContainer.querySelector('video')
      if (videoElement) {
        videoElement.pause();
      }
    }

    let modalMain = document.getElementById('nft-modal')
    document.addEventListener('click', function (event) {
      if (
        !modalContainer.classList.contains('invisible') &&
        (event.target === modalMain || event.target === modalContainer)
      ) {
        pauseModalVideo()
        modalContainer.classList.remove('visible')
        modalContainer.classList.add('invisible')
      }
    }.bind(pauseModalVideo))

    let modalContainer = this.els.containers.nftModal
    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        pauseModalVideo()
        modalContainer.classList.remove('visible')
        modalContainer.classList.add('invisible')
      }
    }.bind(pauseModalVideo))
  }

  pauseModalVideo() {
    let modalImageContainer = this.els.containers.nftModal.querySelector('#nft-modal-image-container')
    let videoElement = modalImageContainer.querySelector('video')
    if (videoElement) {
      videoElement.pause();
    }
  }

  pauseModalAudio() {
    let modalImageContainer = this.els.containers.nftModal.querySelector('#nft-modal-image-container')
    let audioElement = modalImageContainer.querySelector('audio')
    if (audioElement) {
      audioElement.pause();
    }
  }

  renderWallets() {
    let wallets = this.getTextRecord('wallets')
    if (!wallets || !wallets.length) {
      this.els.containers.wallets &&
        this.els.containers.wallets.classList &&
        this.els.containers.wallets.classList.add('hide')
    } else {
      let newHtml = ''
      wallets.forEach((wallet) => {
        if (wallet.value !== '' && wallet.value !== null) {
          newHtml += this.templates.walletEntry({
            name: wallet.name,
            address: wallet.value,
          })
        }
      })
      this.els.containers.walletsEntry.innerHTML = newHtml
      this.els.toggles.wallets.click()
    }
  }

  setImageUrl(imageType, nft, thumbnail) {
    let image_url, media_url = '/static-assets/img/placeholder.png'
    if (imageType === 'nonstandard') {
      image_url = (thumbnail && nft.image_preview_url) ? nft.image_preview_url : nft.image_url
    } else if (imageType === '3d') {
      if (nft.animation_url) {
        image_url = nft.animation_url
      } else if (nft.animation_original_url) {
        image_url = nft.animation_original_url
      } else if (nft.image_preview_url) {
        image_url = nft.image_preview_url
      } else if (nft.image_url) {
        image_url = nft.image_url
      } else if (nft.image_original_url) {
        image_url = nft.image_original_url
      }
    } else if (imageType === 'video') {
      if (nft.animation_url && this.isValidVideoFile(nft.animation_url)) {
        media_url = nft.animation_url
      } else if (nft.animation_original_url && this.isValidVideoFile(nft.animation_original_url)) {
        media_url = nft.animation_original_url
      }
      image_url = nft.image_preview_url
      
    } else if(imageType === 'audio') {
      if (nft.animation_url && this.isValidAudioFile(nft.animation_url)) {
        media_url = nft.animation_url
      } else if (nft.animation_original_url && this.isValidAudioFile(nft.animation_original_url)) {
        media_url = nft.animation_original_url
      }
      image_url = nft.image_preview_url
    } else {
      if (nft.image_preview_url && this.isValidImageFile(nft.image_preview_url)) {
        image_url = nft.image_preview_url
      } else if (nft.animation_url && this.isValidImageFile(nft.animation_url)) {
        image_url = nft.animation_url
      } else if (nft.animation_original_url && this.isValidImageFile(nft.animation_original_url)) {
        image_url = nft.animation_original_url
      } else if (nft.image_url) {
        image_url = nft.image_url
      } else if (nft.image_original_url) {
        image_url = nft.image_original_url
      }
    }

    return {image_url, media_url}
  }

  setIsFullyLoaded(isFullyLoaded) {
    if (isFullyLoaded) {
      this.els.containers.loading.classList.add('hide')
      this.els.containers.main.classList.remove('hide')
    }
    this.data.isFullyLoaded = isFullyLoaded
  }
}
