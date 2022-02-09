const { ethers } = require("ethers");
var https = require('https')

async function main() {
    const domain = 'maaria.eth';
    const provider = new ethers.getDefaultProvider('homestead', {
        alchemy: 'SAvH3fPYB8haW22X6MlXGNpchghVR2sn',
        etherscan: 'RSZ4H2WG1FZ2R9EK5YWJAQFIEIWFCCDJ2C'
    });
    console.log("\r");
    console.log("--------------------");
    console.log(domain);
    console.log("--------------------");
    console.log("\r");

    let resolver = await provider.getResolver(domain);
    // Look into: https://github.com/talentlessguy/get-ens
    // https://eips.ethereum.org/EIPS/eip-634
    let description = await resolver.getText('description');
    let email = await resolver.getText('email');
    let profileUrl = await resolver.getText('url');
    let eth = await resolver.getAddress(60); // https://eips.ethereum.org/EIPS/eip-2304
    console.log(`Description: ${description}`);
    console.log(`Email: ${email}`);
    console.log(`URL: ${profileUrl}`);
    console.log(`ETH: ${eth}`);

    console.log('\rgetting NFTs...\r');

    getScript('https://api.opensea.io/api/v1/assets?owner=0x983110309620D911731Ac0932219af06091b6744&order_direction=desc&offset=0&limit=50').then(response => {
        JSON.parse(response).assets.forEach((asset) => {
            console.log(`
                \tName: ${asset.name}\r
                \tDescription: ${asset.description}\r
                \tLink: ${asset.external_link}\r
                \tPreview: ${asset.image_preview_url}\r
            `);
        })
    })
}


main();
