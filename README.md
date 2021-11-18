<p align=center>
<img width="800" src="https://user-images.githubusercontent.com/19828711/140464079-683afdb2-a213-4e02-a032-93a42e3a93e8.png">
</p>

# Owlracle Web

This is the webserver and frontend code for [Owlracle](https://owlracle.info) website. If you want to check the gas price oracle repo, check [here](https://github.com/werlang/owlracle).

## Motivation

When the dawn of smart networks arrived, dapp developers saw the need to know the [gas price](https://en.wikipedia.org/wiki/Ethereum#Gas) they should pay for submitting a transaction in those networks. While those developers could fetch the last transactions and look at the gas price paid, this method is not reliable enough as gas prices wildly fluctuate between each transaction. So the gas price oracles arrived to help solving this problem. 

Inspired by works like [ethgasstation](https://ethgasstation.info/), I have decided to create a gas price oracle working on several networks. Right now we provide estimations for Ethereum, Binance Smart Chain, Polygon, Fantom and Avalanche networks. Services like owlracle are a way to remove this burden from your servers (this can be somewhat resource-intensive), while providing API to help integrate your dapps to our predictions.

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

<a href="https://t.me/owlracle">
<img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white">
</a>

<a href="https://github.com/werlang/owlracle">
<img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white">
</a>

---

Support our project! We accept any token donation on BSC, Polygon, Fantom, Ethereum, and Avalanche networks.

<h3 align=center>Wallet: 0xA6E126a5bA7aE209A92b16fcf464E502f27fb658</h3>
<p align=center>
	<img width="200" src="https://user-images.githubusercontent.com/19828711/139945432-f6b07860-c986-4221-a291-10370f24ea5a.png">
</p>
