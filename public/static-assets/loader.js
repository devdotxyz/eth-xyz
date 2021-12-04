class EthXyzLoader {
  constructor(domain, isLogging) {
    this.data = {
      isLogging: false,
      isFullyLoaded: false,
      domain: '',
      textRecords: {},
      nfts: [],
    }

    this.templates = {
      profile: _.template(document.getElementById('template-profile').innerHTML),
      avatar: _.template(document.getElementById('template-avatar').innerHTML),
      portfolioEntry: _.template(document.getElementById('template-portfolio-entry').innerHTML),
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
        portfolio: document.getElementById('portfolio-container'),
        nftModal: document.getElementById('nft-modal-container'),
        wallets: document.getElementById('wallets-container'),
        walletsEntry: document.getElementById('wallets-entry-container'),
      },
      toggles: {
        profile: document.getElementById('toggle-profile'),
        portfolio: document.getElementById('toggle-portfolio'),
        wallets: document.getElementById('toggle-wallets'),
      },
    }

    // Set Initial Data
    this.data.isLogging = isLogging
    this.data.domain = domain
    this.log(`Domain is ${domain}`)

    // Load additional data
    this.getTextRecords()
      .then((textRecords) => {
        if (typeof textRecords === 'object') {
          this.data.textRecords = textRecords
        }
        this.getNfts().then((nfts) => {
          if (Array.isArray(nfts)) {
            this.data.nfts = nfts
          }
          this.render()
        })
      })
      .catch((reason) => {
        window.location.href = '/404'
      })
  }

  getTextRecord(record) {
    if (typeof this.data.textRecords[record] !== 'undefined') {
      return this.data.textRecords[record]
    } else {
      return null
    }
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

  async getTextRecords() {
    let response = await fetch(`/text-records/${this.data.domain}`)
    response = await response.json()
    if (response.success) {
      this.log('Received text records')
      return response.data
    } else {
      this.log('No text records found')
      throw 'No text records found.'
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

  closeNftModal() {
    this.els.containers.nftModal.classList.remove('visible')
    this.els.containers.nftModal.classList.add('invisible')
  }

  // Renders data from AJAX into template
  render() {
    this.renderProfile()
    // this.renderAvatar();
    this.renderPortfolio()
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
    let url = this.getTextRecord('url')
    let contentHash = this.getTextRecord('contentHash')
    let contentHashGateway = '';
    if (contentHash && contentHash.indexOf('ipfs://') !== -1)
      contentHashGateway = this.data.domain + '.link'

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
      url === null &&
      contentHash === null
    ) {
      this.els.containers.profile.classList.add('hide')
    } else {
      this.els.containers.profileEntry.innerHTML = this.templates.profile({
        description: description,
        email: email,
        github: github,
        keybase: keybase,
        linkedin: linkedin,
        peepeth: peepeth,
        phone: phone,
        telegram: telegram,
        twitter: twitter,
        url: url,
        contentHash: contentHash,
        contentHashGateway: contentHashGateway,
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
      avatar_url: avatarUrl,
    })
  }

  renderPortfolio() {
    if (!this.data.nfts.length) {
      this.els.containers.portfolio.classList.add('hide')
    } else {
      let newHtml = ''
      this.data.nfts.forEach((nft, index) => {
        newHtml += this.templates.portfolioEntry({
          index: index,
          image_url: nft.animation_url !== null ? nft.animation_url : nft.image_url,
          image_type: (nft.animation_url !== null && nft.animation_url.slice(-4) === '.mp4') ? 'mp4' : 'image',
          name: nft.name,
          description: nft.description,
          url: nft.permalink,
        })
      })
      this.els.containers.portfolioEntry.innerHTML = newHtml
      this.els.toggles.portfolio.click()
    }
  }

  renderNftModal(e) {
    let nft = this.data.nfts[e.dataset.nftIndex]
    let creator_username =
      // eslint-disable-next-line eqeqeq
      nft.creator != null && nft.creator.user != null && nft.creator.user.username != null
        ? nft.creator.user.username
        : null
    let creator_avatar =
      nft.creator != null && nft.creator.profile_img_url != null
        ? nft.creator.profile_img_url
        : null
    let image_url = ''
    if (nft.animation_original_url !== null) {
      image_url = nft.animation_original_url
    } else if (nft.animation_url !== null) {
      image_url = nft.animation_url
    } else if (nft.image_original_url !== null) {
      image_url = nft.image_original_url
    } else if (nft.image_url !== null) {
      image_url = nft.image_url
    }

    let image_type = 'image'
    if ((nft.animation_original_url !== null && nft.animation_original_url.slice(-4) === '.mp4') || (nft.animation_url !== null && nft.animation_url.slice(-4) === '.mp4')) {
      image_type = 'mp4'
    }

    this.els.containers.nftModal.innerHTML = this.templates.nftModal({
      image_url: image_url,
      image_type: image_type,
      name: nft.name,
      description: nft.description,
      creator_username: creator_username,
      creator_avatar: creator_avatar,
      url: nft.permalink,
    })
    this.els.containers.nftModal.classList.remove('invisible', 'invisible-start')
    this.els.containers.nftModal.classList.add('visible')

    let modalContainer = this.els.containers.nftModal
    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        modalContainer.classList.remove('visible')
        modalContainer.classList.add('invisible')
      }
    })

    let modalImageContainer = this.els.containers.nftModal.querySelector(
      '#nft-modal-image-container'
    )

    ;(async () => {
      if (image_type === 'mp4') {
        let videoElement = modalImageContainer.querySelector('video')
        let videoContainer = modalImageContainer.querySelector('.nft-modal__video-container')

        let videoWidth
        let videoHeight
        let aspectRatio

        let videoFrameMaxWidth = 630
        let videoFrameSideMargins = 60

        videoElement.addEventListener( "loadedmetadata", function (e) {
          videoWidth = videoElement.videoWidth
          videoHeight = videoElement.videoHeight

          aspectRatio = videoHeight / videoWidth

          if (videoWidth > videoFrameMaxWidth) {
            videoContainer.style.paddingBottom = aspectRatio * 100 + "%"
          } else {
            let widthPercentage = Math.ceil((videoWidth/videoFrameMaxWidth * 100))
            videoContainer.style.paddingBottom = aspectRatio * widthPercentage + "%"

            window.addEventListener('resize', function() {
              let windowWidth = window.innerWidth

              if (window.innerWidth >= videoWidth + videoFrameSideMargins) {
                videoContainer.style.height = videoHeight + 'px'
                videoContainer.style.removeProperty('padding-bottom')
              } else {
                videoContainer.style.paddingBottom = aspectRatio * 100 + "%"
                videoContainer.style.removeProperty('height')
              }
            }.bind(event, videoWidth, videoHeight))
          }
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
            this.log('NFT image failed to load.')
            throw 'NFT image failed to load.'
          })
      }
    })()

    let modalMain = document.getElementById('nft-modal')
    document.addEventListener('click', function (event) {
      if (
        !modalContainer.classList.contains('invisible') &&
        (event.target === modalMain || event.target === modalContainer)
      ) {
        modalContainer.classList.remove('visible')
        modalContainer.classList.add('invisible')
      }
    })
  }

  renderWallets() {
    let wallets = this.getTextRecord('wallets')
    if (!wallets.length) {
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

  setIsFullyLoaded(isFullyLoaded) {
    if (isFullyLoaded) {
      this.els.containers.loading.classList.add('hide')
      this.els.containers.main.classList.remove('hide')
    }
    this.data.isFullyLoaded = isFullyLoaded
  }
}
