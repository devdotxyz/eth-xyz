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

// Handle 4th level redirect
let subSubDomain = window.location.search.match(/\?domain=(.*?)\.eth\.xyz&/)
if (subSubDomain && subSubDomain.length === 2) {
  window.location.href = 'https://eth.xyz/' + subSubDomain[1] + '.eth'
}
