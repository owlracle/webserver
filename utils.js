const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const configFile = JSON.parse(fs.readFileSync(`${__dirname}/config.json`));


// manage session tokens
class Session {
    static instances = {};

    static getInstance(sid) {
        if (!configFile.production){
            return new Session(1000);
        }
        return Session.instances[sid] || false;
    }

    constructor(timeLimit) {
        this.timeLimit = timeLimit || 1000 * 60 * 10; // 10 minutes
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
        this.timeout = setTimeout(() => delete Session.instances[this.sid], this.timeLimit);
        this.expireAt = new Date().getTime() + this.timeLimit;
    }

}


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


const oracle = {
    url: configFile.production ? `http://owlracle.tk:8080` : `http://127.0.0.1:4220`,

    getTx: async function(address, fromTime, toTime){
        try {
            return await (await fetch(`${this.url}/tx/${address}?fromtime=${fromTime}&totime=${toTime}`)).json();
        }
        catch (error){
            return { error: {
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to fetch transactions from oracle.',
                serverMessage: error,
            }};
        }
    },

    getNetInfo: async function(network='bsc', blocks=200, nmin=0.3){
        try{        
            return await (await fetch(`${this.url}/${network}?blocks=${blocks}&nth=${nmin}`)).json();
        }
        catch (error){
            return { error: {
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to fetch information from price oracle.',
                serverMessage: error,
            }};
        }
    },
};


// network list
const networkList = {
    eth: { name: 'ethereum', token: 'ETH'},
    bsc: { name: 'bsc', token: 'BNB'},
    poly: { name: 'polygon', token: 'MATIC'},
    ftm: { name: 'fantom', token: 'FTM'},
    avax: { name: 'avax', token: 'AVAX'},
};


const explorer = {
    apiKey: configFile.explorer,
    url: {
        eth: `https://api.etherscan.io`,
        bsc: `https://api.bscscan.com`,
        poly: `https://api.polygonscan.com`,
        ftm: `https://api.ftmscan.com`,
        avax: `https://api.snowtrace.io`,
    },

    getBlockNumber: async function(timestamp, network) {
        if (!timestamp){
            timestamp = (new Date().getTime() / 1000).toFixed(0);
        }

        // cache the block number to prevent excessive requests to explorer api
        if (!this.blockNumber){
            this.blockNumber = {};
        }
        if (!this.blockNumber[network]){
            this.blockNumber[network] = {};
        }
        if (this.blockNumber[network][timestamp]){
            return this.blockNumber[network][timestamp];
        }

        try {
            const request = await fetch(`${this.url[network]}/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${this.apiKey[network]}`);
            // snowtrace sometimes return an html, so we must make sure response is json
            const block = (data => {
                try {
                    return JSON.parse(data);
                }
                catch (error) {
                    return { status: '0', message: 'NOTOK', result: 'Explorer returned non JSON response' };
                }
            })(await request.text());
    
            if (block.status == '1'){
                this.blockNumber[network][timestamp] = block.result;
                return block.result;
            }
        }
        catch (error) {
            console.log(error);
        }
        finally {
            await new Promise(resolve => setTimeout(() => resolve(true), 500));
            return await this.getBlockNumber(timestamp, network);
        }
        
        // sample response
        // {"status":"1","message":"OK-Missing/Invalid API Key, rate limit of 1/5sec applied","result":"946206"}
    },

    getTx: async function(wallet, fromTime, toTime, network){
        // console.log(wallet, from, to)
        if (!this.url[network]){
            return { status: "0", message: "INVALID NETWORK", result: [] };
        }
        const fromBlock = await this.getBlockNumber(parseInt(fromTime), network);
        const toBlock = await this.getBlockNumber(parseInt(toTime), network);

        try {
            const request = await fetch(`${this.url[network]}/api?module=account&action=txlist&address=${wallet}&startblock=${fromBlock}&endblock=${toBlock}&apikey=${this.apiKey[network]}`);
            const txs = (data => {
                try {
                    return JSON.parse(data);
                }
                catch (error) {
                    return { status: '0', message: 'NOTOK', result: 'Explorer returned non JSON response' };
                }
            })(await request.text());

            if (txs.status == '0'){
                await new Promise(resolve => setTimeout(() => resolve(true), 500));
                return await this.getTx(wallet, fromTime, toTime, network);
            }

            return txs;
        }
        catch (error) {
            console.log(error);
            return error;
        }

        // sample response
        // return {"status":"1","message":"OK","result":[{"blockNumber":"10510811","timeStamp":"1630423588","hash":"0xc5b336f2bbeb0c684229f1d029c2773710707da8cd66b28d41ff893503c4a218","nonce":"508","blockHash":"0x48073bdbd34f7319576f11f7468a7ab718513f94031fbf27993733c91a25689f","transactionIndex":"242","from":"0x7f5d7e00d82dfeb7e83a0d4285cb21b31feab2b4","to":"0x0288d3e353fe2299f11ea2c2e1696b4a648ecc07","value":"0","gas":"66754","gasPrice":"5000000000","isError":"0","txreceipt_status":"1","input":"0x095ea7b3000000000000000000000000c946a04c1945a1516ed3cf07974ce8dbd4d19005ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","contractAddress":"","cumulativeGasUsed":"45436691","gasUsed":"44503","confirmations":"56642"}]}
    },

    // get balance from wallets
    getMultiBalance: async function(wallets){
        const balance = {};

        const call = async (sliced, network) => {
            return new Promise(resolve => setTimeout(async () => {
                resolve(await (await fetch(`${this.url[network]}/api?module=account&action=balancemulti&address=${sliced.join(',')}&tag=latest&apikey=${this.apiKey[network]}`)).json());
            }, 1500));
        }
    
        // wait to complete every call
        await Promise.all(Object.keys(this.url).map(async network => {
            // we can call 20 at time from explorer
            for (let i=0 ; i < parseInt(wallets.length / 20) + 1 ; i++){
                const sliced = wallets.slice(i*20, (i+1)*20);
                const result = await call(sliced, network);
        
                if (result.status == '1'){
                    result.result.forEach(e => {
                        if (!balance[e.account]){
                            balance[e.account] = {};
                        }
                        balance[e.account][network] = e.balance;
                    });
                }
            }
        }));

        return balance;
    }
};


module.exports = { configFile, Session, verifyRecaptcha, oracle, networkList, explorer };