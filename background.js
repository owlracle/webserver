const { oracle, networkList, logError, telegram } = require('./utils');
const { db } = require('./database');
const fetch = require('node-fetch');
const fs = require('fs');


// get prices to build database with price history
async function buildHistory(network, blocks){
    try{
        const data = await oracle.getNetInfo(networkList[network].name, blocks || 60); // considering 1 block/sec then fetch last 1 minute of blocks = interval of function call

        let minInfo = data.minGwei ? data.minGwei : data.minFee;
        if (minInfo){
            const avgTime = (data.timestamp.slice(-1)[0] - data.timestamp[0]) / (data.timestamp.length - 1);
            // how many blocks to fetch next time
            blocks = parseInt(60 / avgTime + 1);

            if (minInfo.length > blocks){
                data.avgGas = data.avgGas.slice(-blocks);
                minInfo = minInfo.slice(-blocks);
            }

            const avgGas = data.avgGas.reduce((p, c) => p + c, 0) / data.avgGas.length;

            let baseFee = 0;
            if (data.baseFee) {
                baseFee = data.baseFee.filter(e => e); // remove null
                baseFee = baseFee.reduce((p, c) => p + c, 0) / baseFee.length;
            }

            const tokenPrice = JSON.parse(fs.readFileSync(`./tokenPrice.json`))[networkList[network].token].price;

            const [rows, error] = await db.insert(`price_history`, {
                network2: networkList[network].dbid,
                basefee: baseFee,
                last_block: data.lastBlock || 0,
                token_price: tokenPrice,
                avg_gas: avgGas,
                open: minInfo[0],
                close: minInfo.slice(-1)[0],
                low: Math.min(...minInfo),
                high: Math.max(...minInfo),
            });
            
            if (error){
                logError({
                    message: 'error saving history to database',
                    location: 'buildHistory@background.js',
                    error: error,
                });
        
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
        setTimeout(() => updateTokenPrice(), 1000 * 60 * 1); // 1 minute
        return result;
    }
}


async function alertCredit() {
    const [rows, error] = await db.query(`SELECT a.id, k.peek, a.status, k.credit, k.chatid FROM credit_alerts a INNER JOIN api_keys k ON k.id = a.apikey WHERE a.active = 1`);
    if (error){
        console.log(error);
        return;
    }

    rows.forEach(row => {
        const status = JSON.parse(row.status);

        status.expired = status.expired || false;
        status.critical = status.critical || false;

        // expired
        if (!status.expired && row.credit < 0){
            status.expired = true;
            status.critical = true;
            telegram.alert(`??? Your API ???????...${row.peek} run out of credits. Recharge it to keep requesting Owlracle ???? API service.`, { chatId: row.chatid, bot: '@owlracle_gas_bot' });
        }
        // critical
        else if (!status.critical && row.credit < 1){
            status.critical = true;
            telegram.alert(`?????? Your API ???????...${row.peek} have less than $1 in credits ????. Recharge it to prevent applying request limits`, { chatId: row.chatid, bot: '@owlracle_gas_bot' });
        }

        if (row.status != JSON.stringify(status)) {
            db.update('credit_alerts', { status: JSON.stringify(status) }, `id = ?`, [ row.id ]);
        }
    });

    setTimeout(() => alertCredit(), 1000 * 60 * 10); // 10 minute
}

module.exports = { buildHistory, updateTokenPrice, alertCredit };