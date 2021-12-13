# *.eth.xyz

## Summary

Eth.xyz is a service that showcases the public [ENS profile](https://ens.domains/) and NFT collection of any .eth name on a simple, secure, and easily shareable URL. Just add .xyz to the end of any .eth name in any browser and visit the URL.

For example: the ENS profile for [brantly.eth](https://app.ens.domains/name/brantly.eth/details) is accessible in any browser at [brantly.eth.xyz](https://brantly.eth.xyz/).

Every .eth name has been granted automatic access to the eth.xyz feature.

The profile content is automatically generated from publicly available information provided through [ENS](https://ens.domains/) and is ultimately controlled by the relevant [ENS](https://ens.domains/) user.

## Examples

* [https://brantly.eth.xyz](https://brantly.eth.xyz)
* [https://nick.eth.xyz](https://nick.eth.xyz)
* [https://vitalik.eth.xyz](https://vitalik.eth.xyz)

## Stack

* Node
* [Adonis.JS](https://adonisjs.com/)
* [Ethers](https://ethers.io)

## TODO
* Display all wallet addresses
* Display wallet names using common abbreviation (ETH instead of Ethereum)
* Pull all text records in one call for speed

## Basic Setup

(see full notes in DEV.md)

* `cp .env.example .env`
* Add API keys to .env
* `docker-compose up`
* `localhost:8112/brantly.eth` (insert.eth name as you see fit)

## TODO
* Pull all text records in a single call (pending library support)
* Emoji/UTF-8 domain support
* Additional wallet address support
* Include all text records
* Better CI
* Support for .eth subdomains + https (e.g. sub.brantly.eth)

## How to Contribute / Bug Reports / Code of Conduct

This is our first open source project and we currently do not have a formal process. We secured this domain to help you share what you want to the world and this was our first shot. Let us know what you think and feel free to submit a [PR](https://github.com/devdotxyz/eth-xyz/pulls) for contributions and open [issues](https://github.com/devdotxyz/eth-xyz/issues) for any bugs you find :)
