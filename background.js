const { requestOracle, networkList } = require('./utils');
const db = require('./database');
const fetch = require('node-fetch');
const fs = require('fs');


// get prices to build database with price history
async function buildHistory(network, blocks){
    try{
        const data = await requestOracle(networkList[network].name, blocks || 60);

        if (data.minGwei){
            const avgTime = (data.timestamp.slice(-1)[0] - data.timestamp[0]) / (data.timestamp.length - 1);
            // how many blocks to fetch next time
            blocks = parseInt(60 / avgTime + 1);

            if (data.minGwei.length > blocks){
                data.avgGas = data.avgGas.slice(-blocks);
                data.minGwei = data.minGwei.slice(-blocks);
            }

            const avgGas = data.avgGas.reduce((p, c) => p + c, 0) / data.avgGas.length;

            const tokenPrice = parseFloat(JSON.parse(fs.readFileSync(`${__dirname}/tokenPrice.json`)).filter(e => e.symbol == `${networkList[network].token}USDT`)[0].price);

            const [rows, error] = await db.insert(`price_history`, {
                network: network,
                last_block: data.lastBlock,
                token_price: tokenPrice,
                avg_gas: avgGas,
                open: data.minGwei[0],
                close: data.minGwei.slice(-1)[0],
                low: Math.min(...data.minGwei),
                high: Math.max(...data.minGwei),
            });
            
            if (error){
                console.log(error);
            }
        }
    }
    catch (error) {
        console.log(error);
    }
    finally {
        setTimeout(() => buildHistory(network, blocks), 1000 * 60); // 1 minute
    }
}


// update credit recharges and block height for all api keys
async function updateAllCredit(){
    const [rows, error] = await db.query(`SELECT * FROM api_keys`);
    if (!error){
        rows.forEach(async row => {
            api.updateCredit(row);
        });
    }

    setTimeout(() => updateAllCredit(), 1000 * 60 * 60); // 1 hour
}


// update native token prices, and hold a cached price to avoid fetching at every api call
async function updateTokenPrice(){
    const prices = await (await fetch(`https://api.binance.com/api/v3/ticker/price`)).json();
    fs.writeFileSync(`${__dirname}/tokenPrice.json`, JSON.stringify(prices));

    setTimeout(() => updateTokenPrice(), 1000 * 60 * 5); // 5 minutes

    return;
}

module.exports = { buildHistory, updateAllCredit, updateTokenPrice };