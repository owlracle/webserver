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


async function requestOracle(network='bsc', blocks=200){
    try{        
        if (configFile.production){
            return await (await fetch(`http://owlracle.tk:8080/${network}?blocks=${blocks}`)).json();
        }

        // in dev mode. load test data
        const testData = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(`${__dirname}/testData.json`))).map(([k,v]) => [k, Array.isArray(v) ? v.slice(-blocks) : v]));
        return new Promise(resolve => resolve(testData));    
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


// network list
const networkList = {
    eth: { name: 'ethereum', token: 'ETH'},
    bsc: { name: 'bsc', token: 'BNB'},
    poly: { name: 'polygon', token: 'MATIC'},
    ftm: { name: 'fantom', token: 'FTM'},
    avax: { name: 'avax', token: 'AVAX'},
};


module.exports = { configFile, Session, verifyRecaptcha, requestOracle, networkList };