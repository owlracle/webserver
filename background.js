const { oracle, networkList, logError } = require('./utils');
const db = require('./database');
const fetch = require('node-fetch');
const fs = require('fs');


// get prices to build database with price history
async function buildHistory(network, blocks){
    try{
        const data = await oracle.getNetInfo(networkList[network].name, blocks || 60);

        if (data.minGwei){
            const avgTime = (data.timestamp.slice(-1)[0] - data.timestamp[0]) / (data.timestamp.length - 1);
            // how many blocks to fetch next time
            blocks = parseInt(60 / avgTime + 1);

            if (data.minGwei.length > blocks){
                data.avgGas = data.avgGas.slice(-blocks);
                data.minGwei = data.minGwei.slice(-blocks);
            }

            const avgGas = data.avgGas.reduce((p, c) => p + c, 0) / data.avgGas.length;

            const tokenPrice = JSON.parse(fs.readFileSync(`${__dirname}/tokenPrice.json`))[networkList[network].token].price;

            const [rows, error] = await db.insert(`price_history`, {
                network2: networkList[network].dbid,
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
async function updateAllCredit(api){
    const [rows, error] = await db.query(`SELECT * FROM api_keys ORDER BY timeChecked`);
    if (!error){
        // wait before every api update so we dont overload the explorers
        for (let i=0 ; i < rows.length ; i++){
            await api.updateCredit(rows[i]);
        }
    }

    setTimeout(() => updateAllCredit(api), 1000 * 60 * 60); // 1 hour
}


// update native token prices, and hold a cached price to avoid fetching at every api call
async function updateTokenPrice(){
    let result = true;
    try {
        let prices = await (await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ Object.values(networkList).map(e => e.cgid).join(',') }`)).json();
        prices = Object.fromEntries(prices.map(e => [e.symbol.toUpperCase(), { price: parseFloat(e.current_price), change24h: parseFloat(e.price_change_percentage_24h) } ]));
        prices.timestamp = new Date().toISOString();
        
        fs.writeFile(`${__dirname}/tokenPrice.json`, JSON.stringify(prices), () => {});
    }
    catch (error){
        logError({
            message: 'error updating token prices',
            location: 'updateTokenPrice@background.js',
            error: error,
        });
        result = false;
    }
    finally {
        setTimeout(() => updateTokenPrice(), 1000 * 60 * 5); // 5 minutes
        return result;
    }
}

module.exports = { buildHistory, updateAllCredit, updateTokenPrice };