// Handler that uses various data-* attributes to trigger
// specific actions, mimicking bootstrap attributes

const triggers = Array.from(document.querySelectorAll('[data-toggle="collapse"]'));

window.addEventListener('click', (ev) => {
    const elm = ev.target;
    if (triggers.includes(elm)) {
        const selector = elm.getAttribute('data-target');
        collapse(selector, 'toggle');
    }
}, false);

const fnmap = {
    'toggle': 'toggle',
    'show': 'add',
    'hide': 'remove'
};

const collapse = (selector, cmd) => {
    const targets = Array.from(document.querySelectorAll(selector));
    targets.forEach(target => {
        target.classList[fnmap[cmd]]('show');
    });
}


// Truncate addresses based on window width

window.addEventListener('load', function(event){
    truncateText();
});

window.addEventListener('resize', function(event){
    truncateText();
});

function truncateText() {
    let windowWidth = window.innerWidth;

    let beginTruncatingWidth = 574;
    let charWidth = 8.75;
    let numCharsToTruncate = (beginTruncatingWidth - windowWidth) / charWidth;
    numCharsToTruncate = Math.ceil(numCharsToTruncate) + 4;

    let buttons = document.getElementsByClassName('profile__addresses--btn');

    for (let i = 0; i < buttons.length; i++) {
        let button = buttons[i];

        let text = button.dataset.value; // This is so we always have access to the untruncated address

        let truncatedText = text; // Start each time with the untruncated address

        if (windowWidth < beginTruncatingWidth) {
            truncatedText = text.substr(0, (text.length - 3 - numCharsToTruncate)) + '...' + text.substr(text.length-5, text.length);
        }

        let displayText = button.querySelector('.profile__addresses--address-text');

        displayText.innerText = truncatedText;
    }
}


// Copy to clipboard

function copy(e) {
    let text = e.dataset.value;
    let tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    let parent = e.parentNode;
    let notification = parent.querySelector('.notification-copied');
    notification.classList.add('show');
    setTimeout(function() {
        notification.classList.remove('show');
    }, 5000);

}

function toggleNavMenu(e) {
  let nav = document.querySelector("#nav");
  let navContainer = document.querySelector("#nav-modal-container");
  let navMenuContainer = document.querySelector(".nav-menu-container");
  let navMenuContents = document.querySelector(".nav-menu-contents");
  let button = document.querySelector(".nav-toggle-button");

  if (nav.classList.contains('expand')) {
    nav.classList.remove("expand");

    navContainer.classList.add('invisible');
    navContainer.classList.remove('visible');
    button.classList.remove('expand');
  } else {
    nav.classList.add("expand");

    navContainer.classList.remove('invisible', 'invisible-start');
    navContainer.classList.add('visible');
    button.classList.add('expand');
  }

  document.addEventListener('click', function (event) {
    if (
      event.target.classList.contains('nav-menu__link') ||
      (!navContainer.classList.contains('invisible') &&
        (event.target === nav || event.target === navContainer || event.target === navMenuContainer || event.target === navMenuContents))
    ) {
      navContainer.classList.remove('visible');
      navContainer.classList.add('invisible');
      nav.classList.remove("expand");
      button.classList.remove('expand');
    }
  })

  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      navContainer.classList.remove('visible');
      navContainer.classList.add('invisible');
      nav.classList.remove("expand");
      button.classList.add('expand');
    }
  });
}
