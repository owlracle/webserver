<p align=center>
<img width="800" src="https://user-images.githubusercontent.com/19828711/140464079-683afdb2-a213-4e02-a032-93a42e3a93e8.png">
</p>

# Owlracle Web

This is the webserver and frontend code for [Owlracle](https://owlracle.info) website. If you want to check the gas price oracle repo, check [here](https://github.com/werlang/owlracle).

## Motivation

When the dawn of smart networks arrived, dapp developers saw the need to know the [gas price](https://en.wikipedia.org/wiki/Ethereum#Gas) they should pay for submitting a transaction in those networks. While those developers could fetch the last transactions and look at the gas price paid, this method is not reliable enough as gas prices wildly fluctuate between each transaction. So the gas price oracles arrived to help solving this problem. 

Inspired by works like [ethgasstation](https://ethgasstation.info/), I have decided to create a gas price oracle working on several networks. Right now we provide estimations for Ethereum, BNB Chain, Polygon, Fantom, Avalanche, Moonriver, and Cronos networks. Services like owlracle are a way to remove this burden from your servers (this can be somewhat resource-intensive), while providing API to help integrate your dapps to our predictions.

## Gas Price Estimation

 ```/gas``` endpoint retrive not only the average gas price paid in the last N transactions in the chosen network, but also the average gas fee (in USD) paid and native token price. The main difference from other API oracle services is that Owlracle  endpoint return fully customized information:

 * How many transactions in the past will be analysed for making the calculations? *Default 200* blocks in the past;
 * What is the desired transaction acceptance rate you are looking for? e.g. 60% blocks accepted a transaction using a given gas price.
 * How many acceptance rates you want to track? You can provice a list. In practice, this is the same as *speeds* from similar services. But in Owlracle, you can fully customize it.
 * Number of lowest gas transactions to be considered when calculating minimum gas price accepted by the block.

## Gas price history

```/history``` endpoint retrieve [candlestick](https://en.wikipedia.org/wiki/Candlestick_chart) information about historic gas prices, native token price, and gas fee (in USD) paid over the course of time. You can customize the desired timeframe, and the time period of the search.

##

### Want to know more? Check [owlracle.info](https://owlracle.info) for a full documentation.

<a href="https://twitter.com/owlracleAPI">
<img src="https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white">
</a>

<a href="https://facebook.com/owlracle">
<img src="https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white">
</a>

<a href="https://t.me/owlracle">
<img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white">
</a>

<a href="https://github.com/owlracle">
<img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white">
</a>

---

Support our project! We accept any token donation on <img src="https://owlracle.info/img/bsc.png" height="20"> **BSC**, <img src="https://owlracle.info/img/poly.png" height="20"> **Polygon**, <img src="https://owlracle.info/img/ftm.png" height="20"> **Fantom**, <img src="https://owlracle.info/img/eth.png" height="20"> **Ethereum**, <img src="https://owlracle.info/img/avax.png" height="20"> **Avalanche**, <img src="https://owlracle.info/img/movr.png" height="20"> **Moonriver**, and <img src="https://owlracle.info/img/cro.png" height="20"> **Cronos** networks.

<a href="https://user-images.githubusercontent.com/19828711/139945432-f6b07860-c986-4221-a291-10370f24ea5a.png">
<h3 align=center><img src="https://img.shields.io/badge/Wallet-0xA6E126a5bA7aE209A92b16fcf464E502f27fb658-blue"></h3>
<p align=center>
	<img width="200" src="https://user-images.githubusercontent.com/19828711/139945432-f6b07860-c986-4221-a291-10370f24ea5a.png">
</p>
</a>
