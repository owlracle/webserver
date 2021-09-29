const { requestOracle, bscscan } = require('./utils');
const db = require('./database');
const fetch = require('node-fetch');
const fs = require('fs');


// get prices to build database with price history
async function buildHistory(){
    try{
        const data = await requestOracle();

        if (data.speeds){
            const [rows, error] = await db.insert(`price_history`, {
                slow: data.speeds[0],
                standard: data.speeds[1],
                fast: data.speeds[2],
                instant: data.speeds[3],
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
        setTimeout(() => buildHistory(), 1000 * 60); // 1 minute
    }
}


// update credit recharges and block height for all api keys
async function updateAllCredit(){
    const [rows, error] = await db.query(`SELECT * FROM api_keys`);
    if (!error){
        const blockHeight = await bscscan.getBlockHeight();
        rows.forEach(async row => {
            api.updateCredit(row, blockHeight);
        });
    }

    setTimeout(() => updateAllCredit(), 1000 * 60 * 60); // 1 hour
}


// update native token prices, and hold a cached price to avoid fetching at every api call
async function updateTokenPrice(){
    const prices = await (await fetch(`https://api.binance.com/api/v3/ticker/price`)).json();
    fs.writeFileSync(`${__dirname}/tokenPrice.json`, JSON.stringify(prices));

    setTimeout(() => updateTokenPrice(), 1000 * 60 * 5); // 5 minutes
}

module.exports = { buildHistory, updateAllCredit, updateTokenPrice };