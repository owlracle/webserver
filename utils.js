const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const configFile = JSON.parse(fs.readFileSync(`${__dirname}/config.json`));


// manage session tokens
class Session {
    static instances = {};
    static timeLimit = 1000 * 60 * 10; // 10 minutes

    static getInstance(sid) {
        return Session.instances[sid] || false;
    }

    constructor() {
        this.sid = uuidv4().split('-').join('');
        Session.instances[this.sid] = this;
        this.refresh();
    }

    getId() {
        return this.sid;
    }

    getExpireAt() {
        return this.expireAt;
    }

    refresh() {
        if (this.timeout){
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => delete Session.instances[this.sid], Session.timeLimit);
        this.expireAt = new Date().getTime() + Session.timeLimit;
    }

}


const bscscan = {
    apiKey: configFile.bscscan,

    getBlockHeight: async function() {
        const timeNow = (new Date().getTime() / 1000).toFixed(0);
        let block = await (await fetch(`https://api.bscscan.com/api?module=block&action=getblocknobytime&timestamp=${timeNow}&closest=before&apikey=${this.apiKey}`)).json();
        
        return block.result;
    },

    getTx: async function(wallet, from, to){
        // console.log(wallet, from, to)
        return await (await fetch(`https://api.bscscan.com/api?module=account&action=txlist&address=${wallet}&startblock=${from}&endblock=${to}&apikey=${this.apiKey}`)).json();
        // sample response
        // return {"status":"1","message":"OK","result":[{"blockNumber":"10510811","timeStamp":"1630423588","hash":"0xc5b336f2bbeb0c684229f1d029c2773710707da8cd66b28d41ff893503c4a218","nonce":"508","blockHash":"0x48073bdbd34f7319576f11f7468a7ab718513f94031fbf27993733c91a25689f","transactionIndex":"242","from":"0x7f5d7e00d82dfeb7e83a0d4285cb21b31feab2b4","to":"0x0288d3e353fe2299f11ea2c2e1696b4a648ecc07","value":"0","gas":"66754","gasPrice":"5000000000","isError":"0","txreceipt_status":"1","input":"0x095ea7b3000000000000000000000000c946a04c1945a1516ed3cf07974ce8dbd4d19005ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","contractAddress":"","cumulativeGasUsed":"45436691","gasUsed":"44503","confirmations":"56642"}]}
    },

    getBNBBalance: async function() {
        const [rows, error] = await db.query(`SELECT wallet FROM api_keys`);
        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error searching for wallets.',
                serverMessage: error,
            });
            return;
        }

        const wallets = rows.map(row => row.wallet);
        const balance = [];

        const call = async (sliced) => {
            return new Promise(resolve => setTimeout(async () => {
                resolve(await (await fetch(`https://api.bscscan.com/api?module=account&action=balancemulti&address=${sliced.join(',')}&tag=latest&apikey=${this.apiKey}`)).json());
            }, 1500));
        }

        // we can call 20 at time from bscscan
        for (let i=0 ; i < parseInt(wallets.length / 20) + 1 ; i++){
            const sliced = wallets.slice(i*20, (i+1)*20);
            const result = await call(sliced);
            console.log(result)

            if (result.status == '1'){
                result.result.forEach(e => balance.push([e.account, e.balance]));
            }
        }

        return Object.fromEntries(balance);
    }
};


async function verifyRecaptcha(token){
    const secret = configFile.recaptcha.secret;

    try {
        const data = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            body: `secret=${secret}&response=${token}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return await data.json();
    }
    catch(error){
        console.log(error);
        return error;
    }
}


async function requestOracle(network='bsc'){
    try{        
        if (configFile.production){
            const oracleData = await (await fetch(`http://owlracle.tk:8080/${network}`)).json();
    
            const avgTx = oracleData.ntx.reduce((p,c) => p+c, 0) / oracleData.ntx.length;
            const avgTime = (oracleData.timestamp.slice(-1)[0] - oracleData.timestamp[0]) / (oracleData.timestamp.length - 1);
    
            // sort gwei array ascending so I can pick directly by index
            const sortedGwei = oracleData.minGwei.sort((a,b) => parseFloat(a) - parseFloat(b));
    
            const speedSize = {
                safeLow: 35,
                standard: 60,
                fast: 90,
                fastest: 100
            };
    
            const speeds = Object.values(speedSize).map(speed => {
                // get gwei corresponding to the slice of the array
                const poolIndex = parseInt(speed / 100 * oracleData.minGwei.length) - 1;
                const speedGwei = sortedGwei[poolIndex];
                return speedGwei;
            });
    
            const result = {
                lastBlock: oracleData.lastBlock,
                avgTx: avgTx,
                avgTime: avgTime,
                speeds: speeds,
            };
    
            return result;
        }
        return new Promise(resolve => resolve({ lastBlock: 7499408, avgTx: 150, avgTime: 3, speeds: [5,5,5,5] }));    
    }
    catch (error){
        return { error: {
            status: 500,
            error: 'Internal Server Error',
            message: 'Error while trying to fetch information from price oracle.',
            serverMessage: error,
        }};
    }
}


module.exports = { configFile, Session, verifyRecaptcha, requestOracle, bscscan };