const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');

const { Session, verifyRecaptcha, oracle, networkList, explorer, telegram, configFile } = require('./utils');
const db = require('./database');

const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200,
};

const sampleRespone = JSON.parse(fs.readFileSync(`${__dirname}/sampleResponse.json`));

module.exports = app => {
    // old endpoint. will still work for now

    app.get('/gas', cors(corsOptions), async (req, res, next) => {
        if (!req.query.version){
            req.query.version = 1;
        }

        req.url = '/bsc/gas?' + new URLSearchParams(req.query).toString();
        next();
    });

    // discover gas prices right now

    app.get('/:network/gas', cors(corsOptions), async (req, res) => {
        if (req.query.apikey == sampleRespone.apiPlaceholder){
            res.send(sampleRespone.endpoints.gas);
            return;
        }

        const dataRun = async () => {
            const resp = {};
            if (!Object.keys(networkList).includes(req.params.network)){
                return { error: {
                    status: 404,
                    error: 'Not found',
                    message: 'The requested network is not available.'
                }};
            }
            const network = networkList[req.params.network];

            if (req.query.apikey == sampleRespone.apiPlaceholder){
                return sampleRespone.endpoints.gas;
            }

            // accept and blocks only work when using v2
            const defaultSpeeds = [35, 60, 90, 100];
            const version = parseInt(req.query.version) || 2;
            const blocks = req.query.blocks && version == 2 ? Math.min(Math.max(parseInt(req.query.blocks), 0), 1000) : 200;
            const accept = req.query.accept && version == 2 ? req.query.accept.split(',').map(e => Math.min(Math.max(parseInt(e), 0), 100)) : defaultSpeeds;

            if (req.query.nmin){
                req.query.percentile = req.query.nmin;
                const warning = 'nmin argument is deprecated and will be removed in future updates. Use percentile instead.';
                resp.warning = resp.warning ? `${resp.warning}. ${warning}` : warning;
            }
            const perc = version == 1 ? 1 : (req.query.percentile ? parseFloat(req.query.percentile) : 0.3);
    
            const data = await oracle.getNetInfo(network.name, blocks, perc);
            if (data.error){
                return { error: data.error };
            }
        
            if (data.minGwei) {
                resp.timestamp = new Date().toISOString();

                const avgTx = data.ntx.reduce((p, c) => p + c, 0) / data.ntx.length;
                const avgTime = (data.timestamp.slice(-1)[0] - data.timestamp[0]) / (data.timestamp.length - 1);

                // sort gwei array ascending so I can pick directly by index
                const sortedGwei = data.minGwei.sort((a, b) => parseFloat(a) - parseFloat(b));

                let speeds = accept.map(speed => {
                    // get gwei corresponding to the slice of the array
                    const poolIndex = parseInt(speed / 100 * sortedGwei.length) - 1;
                    return sortedGwei[poolIndex];
                });
                
                // avg gas and estimated gas fee price (in $)
                const avgGas = data.avgGas.reduce((p, c) => p + c, 0) / data.avgGas.length;
                const tokenPrice = JSON.parse(fs.readFileSync(`${__dirname}/tokenPrice.json`))[network.token].price;

                // report base fee if available and not opted out
                if (data.baseFee) {
                    // remove null
                    resp.baseFee = data.baseFee.filter(e => e);
                    resp.baseFee = resp.baseFee.reduce((p, c) => p + c, 0) / resp.baseFee.length;
                }

                speeds = speeds.map(speed => {
                    return {
                        acceptance: sortedGwei.filter(e => e <= speed).length / sortedGwei.length,
                        gasPrice: speed,
                        estimatedFee: (speed * 0.000000001) * avgGas * tokenPrice,
                    };
                });

                if (version === 1){
                    resp.slow = speeds[0].gasPrice;
                    resp.standard = speeds[1].gasPrice;
                    resp.fast = speeds[2].gasPrice;
                    resp.instant = speeds[3].gasPrice;
                    resp.block_time = avgTime;
                    resp.last_block = data.lastBlock;
                }
                else if (version === 2){
                    // resp.sw = sortedGwei;
                    resp.lastBlock = data.lastBlock;
                    resp.avgTime = avgTime;
                    resp.avgTx = avgTx;
                    resp.avgGas = avgGas;
                    resp.speeds = speeds;
                }
            }
    
            return resp;
        }
    
        // request google recaptcha
        if (req.query.grc && req.query.sid) {
            const session = Session.getInstance(req.query.sid);
            if (!session){
                res.status(401);
                res.send({
                    status: 401,
                    error: 'Unauthorized',
                    message: 'Session token invalid.',
                });
                return;
            }
            session.refresh();
    
            const rc = await verifyRecaptcha(req.query.grc);
            
            if (rc.success && rc.score >= 0.1){
                const data = await dataRun();
                res.send(data);
                return;
            }
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Failed to verify recaptcha.',
                serverMessage: rc
            });
            return;
        }
    
        const resp = await api.automate({
            key: req.query.apikey,
            origin: req.header('Origin'),
            ip: req.header('x-real-ip'),
            endpoint: 'gas',
            version: parseInt(req.query.version) || 2,
            network: req.params.network,
            source: req.query.source || 'api',
            action: {
                data: {},
                run: dataRun,
            }
        });
        if (resp.error){
            res.status(resp.error.status || 500);
            res.send(resp.error);
            return;
        }
    
        res.send(resp);
    });
    
    
    // price history
    app.get('/:network/history', cors(corsOptions), async (req, res) => {
        const timeframe = req.query.timeframe;
        const candles = req.query.candles;
        const page = req.query.page;
        const from = req.query.from;
        const to = req.query.to;
    
        if (req.query.apikey == sampleRespone.apiPlaceholder){
            res.send(sampleRespone.endpoints.history);
            return;
        }

        const dataRun = async ({ timeframe, candles, page, from, to }) => {
            if (!Object.keys(networkList).includes(req.params.network)){
                return { error: {
                    status: 404,
                    error: 'Not found',
                    message: 'The requested network is not available.'
                }};
            }
            const network = req.params.network;
            // const version = parseInt(req.query.version) || 2;

            const listTimeframes = {
                '10m': 10,
                '30m': 30,
                '1h': 60,
                '2h': 120,
                '4h': 240,
                '1d': 1440,
            };
        
            timeframe = Object.keys(listTimeframes).includes(timeframe) ? listTimeframes[timeframe] : 
                (Object.values(listTimeframes).map(e => e.toString()).includes(timeframe) ? timeframe : 30);
        
            candles = Math.max(Math.min(candles || 100, 1000), 1);
            const offset = (parseInt(page) - 1) * candles || 0;

            const data = [
                networkList[network].dbid,
                from || 0,
                to || new Date().getTime() / 1000,
                timeframe * 60,
                candles,
                offset,
            ];

            // if (!from || !to){
            //     // discover lower and upper timestamp limits to improve search performance
            //     const sql = `SELECT MIN(UNIX_TIMESTAMP(timestamp)) AS 'min', MAX(UNIX_TIMESTAMP(timestamp)) AS 'max' FROM price_history WHERE network2 = ? AND timestamp >= FROM_UNIXTIME(?) AND timestamp < FROM_UNIXTIME(?) GROUP BY timestamp DIV ? ORDER BY timestamp DESC LIMIT ? OFFSET ?;`;
            //     const [rows, error] = await db.query(sql, data);

            //     if (error){
            //         return { error: {
            //             status: 500,
            //             error: 'Internal Server Error',
            //             message: 'Error while retrieving price history information from database.',
            //             serverMessage: error,
            //         }};
            //     }

            //     data[1] = rows.slice(-1)[0].min; // from
            //     data[2] = rows[0].max; // to
            //     data.pop();
            // }

            const sql = `SELECT GROUP_CONCAT(p.open) AS 'open', GROUP_CONCAT(p.close) AS 'close', GROUP_CONCAT(p.low) AS 'low', GROUP_CONCAT(p.high) AS 'high', GROUP_CONCAT(p.token_price) AS 'tokenprice', MAX(p.timestamp) AS 'timestamp', count(*) AS 'samples', GROUP_CONCAT(p.avg_gas) AS 'avg_gas' FROM price_history p WHERE network2 = ? AND timestamp >= FROM_UNIXTIME(?) AND timestamp < FROM_UNIXTIME(?) GROUP BY timestamp DIV ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
            
            const [rows, error] = await db.query(sql, data);
        
            if (error){
                return { error: {
                    status: 500,
                    error: 'Internal Server Error',
                    message: 'Error while retrieving price history information from database.',
                    serverMessage: error,
                }};
            }
    
            return rows.map(row => {
                const open = row.open.split(',').map(e => parseFloat(e));
                const close = row.close.split(',').map(e => parseFloat(e));
                const low = row.low.split(',').map(e => parseFloat(e));
                const high = row.high.split(',').map(e => parseFloat(e));
                const tokenprice = row.tokenprice.split(',').map(e => parseFloat(e));
                const avgGas = row.avg_gas.split(',').map(e => parseFloat(e));

                const tempRow = {};
                tempRow.gasPrice = {
                    open: open[0],
                    close: close.slice(-1)[0],
                    low: Math.min(...low),
                    high: Math.max(...high),
                }
                if (req.query.tokenprice){
                    tempRow.tokenPrice = {
                        open: tokenprice[0],
                        close: tokenprice.slice(-1)[0],
                        low: Math.min(...tokenprice),
                        high: Math.max(...tokenprice),
                    }
                }
                if (req.query.txfee){
                    const txfee = tokenprice.map((t,i) => close[i] * avgGas[i] * t * 0.000000001);

                    tempRow.txFee = {
                        open: txfee[0],
                        close: txfee.slice(-1)[0],
                        low: Math.min(...txfee),
                        high: Math.max(...txfee),
                    }
                }

                tempRow.avgGas = avgGas.reduce((p,c) => p + c, 0) / avgGas.length;
                tempRow.timestamp = row.timestamp;
                tempRow.samples = row.samples;
                return tempRow;
            });
        };
    
        if (req.query.grc && req.query.sid) {
            const session = Session.getInstance(req.query.sid);
            if (!session){
                res.status(401);
                res.send({
                    status: 401,
                    error: 'Unauthorized',
                    message: 'Session token invalid.',
                });
                return;
            }
            session.refresh();
    
            const rc = await verifyRecaptcha(req.query.grc);
    
            if (rc.success && rc.score >= 0.1){
                const data = await dataRun({
                    timeframe: timeframe,
                    candles: candles,
                    page: page,
                    from: from,
                    to: to,
                });
    
                res.send(data);
                return;
            }
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Failed to verify recaptcha.',
                serverMessage: rc
            });
            return;
        }
    
        let resp = await api.automate({
            key: req.query.apikey,
            origin: req.header('Origin'),
            ip: req.header('x-real-ip'),
            endpoint: 'history',
            version: parseInt(req.query.version) || 2,
            network: req.params.network,
            source: req.query.source || 'api',
            action: {
                data: {
                    timeframe: timeframe,
                    candles: candles,
                    page: page,
                    from: from,
                    to: to,
                },
                run: dataRun
            }
        });
        if (resp.error){
            res.status(resp.error.status || 500);
            res.send(resp.error);
            return;
        }
    
        res.send(resp);
    });
    
    
    // generate new api key
    app.post('/keys', async (req, res) => {
        if (!req.body || !req.body.grc) {
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Your request did not send all the required fields.',
            });
            return;
        }
    
        const rc = await verifyRecaptcha(req.body.grc);
        if (!rc.success || rc.score < 0.1){
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Failed to verify recaptcha.',
                serverMessage: rc
            });
            return;
        }
    
        const key = uuidv4().split('-').join('');
        const secret = uuidv4().split('-').join('');
    
        const keyCryptPromise = bcrypt.hash(key, 10); 
        const secretCryptPromise = bcrypt.hash(secret, 10);
    
        
        const hash = await Promise.all([keyCryptPromise, secretCryptPromise]);
        
        try {
            // create new wallet for deposits
            // const wallet = await (await fetch('https://api.blockcypher.com/v1/eth/main/addrs', { method: 'POST' })).json();
            
            const data = {
                apiKey: hash[0],
                secret: hash[1],
                // wallet: `0x${wallet.address}`,
                // private: wallet.private,
                peek: key.slice(-4),
            };
        
            if (req.body.origin){
                const origin = api.getOrigin(req.body.origin);
                if (origin){
                    data.origin = origin;
                }
            }
            if (req.body.note){
                data.note = req.body.note;
            }
    
            const [rows, error] = await db.insert('api_keys', data);
        
            if (error){
                res.status(500);
                res.send({
                    status: 500,
                    error: 'Internal Server Error',
                    message: 'Error while trying to insert new api key to database',
                    serverMessage: error,
                });
                return;
            }

            res.send({
                apiKey: key,
                secret: secret,
                // wallet: data.wallet,
            });
        }
        catch (error) {
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error creating new wallet. Try again in a few minutes.',
                serverMessage: error,
            });
        }
    });
    
    
    // edit api key information
    app.put('/keys/:key', async (req, res) => {
        const key = req.params.key;
        const secret = req.body.secret;
    
        if (!key.match(/^[a-f0-9]{32}$/)){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'The informed api key is invalid.'
            });
        }
        else if (!secret){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'The api secret was not provided.'
            });
        }
        else {
            const [rows, error] = await db.query(`SELECT * FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);
    
            if (error){
                res.status(500);
                res.send({
                    status: 500,
                    error: 'Internal Server Error',
                    message: 'Error while trying to search the database for your api key.',
                    serverMessage: error,
                });
            }
            else{
                const rowsPromise = rows.map(row => Promise.all([
                    bcrypt.compare(key, row.apiKey),
                    bcrypt.compare(secret, row.secret)
                ]));
                const row = (await Promise.all(rowsPromise)).map((e,i) => e[0] && e[1] ? rows[i] : false).filter(e => e);
    
                if (row.length == 0){
                    res.status(401);
                    res.send({
                        status: 401,
                        error: 'Unauthorized',
                        message: 'Could not find an api key matching the provided secret key.'
                    });
                }
                else {
                    const data = {};
                    const id = row[0].id;
        
                    let newKey = key;
        
                    // fields to edit
                    if (req.body.resetKey){
                        newKey = uuidv4().split('-').join('');
                        data.peek = newKey.slice(-4);
                        data.apiKey = await bcrypt.hash(newKey, 10);
                    }
                    if (req.body.origin){
                        data.origin = req.body.origin;
                    }
                    if (req.body.note){
                        data.note = req.body.note;
                    }
        
                    if (Object.keys(data).length == 0){
                        res.send({ message: 'No information was changed.' });
                    }
                    else {
                        const [rows, error] = await db.update('api_keys', data, `id = ?`, [id]);
                        
                        if (error){
                            res.status(500);
                            res.send({
                                status: 500,
                                error: 'Internal Server Error',
                                message: 'Error while trying to update api key information.',
                                serverMessage: error,
                            });
                        }
                        else{
                            data.apiKey = newKey;
                            delete data.peek;
            
                            res.send({
                                message: 'api key ionformation updated.',
                                ...data
                            });
                        }
                    }
        
                }
            }
        }
    });
    
    
    // get api usage logs
    app.get('/logs/:key', cors(corsOptions), async (req, res) => {
        const key = req.params.key;
    
        if (key == sampleRespone.apiPlaceholder){
            res.send(sampleRespone.endpoints.logs);
            return;
        }

        if (!key.match(/^[a-f0-9]{32}$/)){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'The informed api key is invalid.'
            });
            return;
        }

        let [rows, error] = await db.query(`SELECT * FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to search the database for your api key.',
                serverMessage: error,
            });
            return;
        }

        const row = (await Promise.all(rows.map(row => bcrypt.compare(key, row.apiKey)))).map((e,i) => e ? rows[i] : false).filter(e => e);

        if (row.length == 0){
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Could not find your api key.'
            });
            return;
        }

        const id = row[0].id;
        const toTime = req.query.totime || db.raw('UNIX_TIMESTAMP(now())');
        const fromTime = req.query.fromtime || (req.query.totime ? parseInt(req.query.totime) - 3600 : db.raw('UNIX_TIMESTAMP(now()) - 3600'));

        const sql = `SELECT r.ip AS ip, origin, timestamp, endpoint, n.symbol AS network FROM api_requests r INNER JOIN networks n ON n.id = r.network2 WHERE UNIX_TIMESTAMP(timestamp) >= ? AND UNIX_TIMESTAMP(timestamp) <= ? AND apiKey = ? ORDER BY timestamp DESC LIMIT 10000`;
        const sqlData = [
            fromTime,
            toTime,
            id,
        ];

        [rows, error] = await db.query(sql, sqlData);

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to fetch your logs.',
                serverMessage: error,
            });
            return;
        }

        res.send(rows);
    });
    
    
    // get api key info
    app.get('/keys/:key', cors(corsOptions), async (req, res) => {
        const key = req.params.key;
    
        if (key == sampleRespone.apiPlaceholder){
            res.send(sampleRespone.endpoints.keys);
            return;
        }

        if (!key.match(/^[a-f0-9]{32}$/)){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'The informed api key is invalid.'
            });
            return;
        }

        let [rows, error] = await db.query(`SELECT * FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to search the database for your api key.',
                serverMessage: error,
            });
            return;
        }

        const row = (await Promise.all(rows.map(row => bcrypt.compare(key, row.apiKey)))).map((e,i) => e ? rows[i] : false).filter(e => e);

        if (row.length == 0){
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Could not find your api key.'
            });
            return;
        }

        const id = row[0].id;

        const data = {
            apiKey: key,
            creation: row[0].creation,
            wallet: row[0].wallet,
            credit: row[0].credit
        };

        if (row[0].origin){
            data.origin = row[0].origin;
        }
        if (row[0].note){
            data.note = row[0].note;
        }

        const hourApi = `SELECT count(*) FROM api_requests WHERE apiKey = ? AND timestamp >= now() - INTERVAL 1 HOUR`;
        const totalApi = `SELECT count(*) FROM api_requests WHERE apiKey = ?`;

        [rows, error] = await db.query(`SELECT (${hourApi}) AS hourapi, (${totalApi}) AS totalapi`, [ id, id ]);

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to search the database for your api key.',
                serverMessage: error,
            });
            return;
        }

        data.usage = {
            apiKeyHour: rows[0].hourapi,
            apiKeyTotal: rows[0].totalapi,
        };

        [rows, error] = await db.query(`SELECT chatid FROM credit_alerts WHERE apikey = ? AND active = 1`, [ id ]);

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to search the database for your api key.',
                serverMessage: error,
            });
            return;
        }

        if (rows.length){
            data.creditNotification = rows.map(row => row.chatid);
        }

        res.send(data);
    });
    
    
    // request credit info
    app.get('/credit/:key', cors(corsOptions), async (req, res) => {
        const key = req.params.key;
    
        if (key == sampleRespone.apiPlaceholder){
            res.send(sampleRespone.endpoints.credit);
            return;
        }

        if (!key.match(/^[a-f0-9]{32}$/)){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'The informed api key is invalid.'
            });
            return;
        }

        let [rows, error] = await db.query(`SELECT * FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to search the database for your api key.',
                serverMessage: error,
            });
            return;
        }

        const row = (await Promise.all(rows.map(row => bcrypt.compare(key, row.apiKey)))).map((e,i) => e ? rows[i] : false).filter(e => e);

        if (row.length == 0){
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Could not find your api key.'
            });
            return;
        }

        [rows, error] = await db.query(`SELECT n.symbol AS network, tx, timestamp, value, price, fromWallet FROM credit_recharges INNER JOIN networks n ON n.id = network2 WHERE apiKey = ? ORDER BY timestamp DESC`, [ row[0].id ]);

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while retrieving your credit information.',
                serverMessage: error,
            });
            return;
        }

        res.send({
            message: 'success',
            results: rows
        });
    });
    
    
    // update credit
    app.put('/credit/:key', async (req, res) => {
        const key = req.params.key;
        const tx = req.body.transactionHash;
        const network = req.body.network;
        const row = await api.validateKey(key);

        if (row.status != 200) {
            res.status(row.status).send(row.send);
            return;
        }

        const txs = await (tx ? api.updateCredit(row.send, tx, network) : api.updateCreditLegacy(row.send));
        res.send(txs);
    });


    app.get('/tokenprice/:token', async (req, res) => {
        const token = JSON.parse(fs.readFileSync(`${__dirname}/tokenPrice.json`))[req.params.token.toUpperCase()];

        if (!token){
            res.status(404).send({
                status: 404,
                error: 'Not Found',
                message: 'The token you are looking for could not be found.',
            });
            return;
        }

        res.send(token);
    });
    

    return api;
}


const api = {
    USAGE_LIMIT: 100,
    GUEST_LIMIT: 10,
    REQUEST_COST: 0.00005,

    getUsage: async function(keyId, ip) {
        const usage = { ip: 0, apiKey: 0 };

        if (ip) {
            // get usage from ip
            const [rows, error] = await db.query(`SELECT count(*) AS total FROM api_requests WHERE ip = ? AND timestamp > now() - INTERVAL 1 HOUR`, [ ip ]);
    
            if (error){
                return { error: {
                    status: 500,
                    error: 'Internal Server Error',
                    message: 'Error while trying to discover your api usage.',
                    serverMessage: error,
                }};
            }

            usage.ip = rows[0].total;
        }

        if (keyId) {
            // sent key hash instead of id
            if (typeof keyId === 'string' && keyId.length == 32){
                const keyInfo = await this.getKeyInfo(keyId);
                if (keyInfo.result){
                    keyId = keyInfo.result.id;
                }
                else {
                    return { error: keyInfo.error };
                }
            }

            // discorver usage from api key
            const [rows, error] = await db.query(`SELECT count(*) AS total FROM api_requests WHERE apiKey = ? AND timestamp > now() - INTERVAL 1 HOUR`, [ keyId ]);
    
            if (error){
                return { error: {
                    status: 500,
                    error: 'Internal Server Error',
                    message: 'Error while trying to discover your api usage.',
                    serverMessage: error,
                }};
            }

            usage.apiKey = rows[0].total;
        }

        return usage;
    },

    getKeyInfo: async function(key){
        const [rows, error] = await db.query(`SELECT id, apiKey, credit, origin FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);

        if (error){
            return { error: {
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to retrieve api key information from database',
                serverMessage: error
            }};
        }

        const row = (await Promise.all(rows.map(row => bcrypt.compare(key, row.apiKey)))).map((e,i) => e ? rows[i] : false).filter(e => e);

        if (row.length == 0){
            return { error: {
                status: 401,
                error: 'Unauthorized',
                message: 'Could not find your api key.'
            }};
        }

        return { result: row[0] };
    },

    getOrigin: function(origin){
        const originRegex = new RegExp(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9._-]{1,256}\.[a-z0-9]{1,10})\b.*$/);
        const match = origin.match(originRegex);
        return match && match[1] ? match[1] : false;
    },

    validateOrigin: async function(keyOrigin, reqOrigin){
        let originAllow = true;
        if (keyOrigin){
            if (reqOrigin){
                const realOrigin = this.getOrigin(reqOrigin);
                if (keyOrigin != realOrigin){
                    originAllow = false;
                }
            }
            else{
                originAllow = false;
            }
        }

        if (!originAllow){
            return { error: {
                status: 403,
                error: 'Forbidden',
                message: 'The API key your are using does not allow calls from this origin.',
            }};
        }

        return true;
    },

    authorizeKey: function(key, ip, usage, credit){
        if (!ip && !key){
            return { error: {
                status: 401,
                error: 'Unauthorized',
                message: 'You must provide an api key for this action.'
            }};
        }
        else if (!key && (usage.ip >= this.GUEST_LIMIT)) {
            return { error: {
                status: 403,
                error: 'Forbidden',
                message: 'You have reached the guest limit. Use an api key to increase your request limit.'
            }};
        }
        else if (key && credit < 0 && (usage.apiKey >= this.USAGE_LIMIT || usage.ip >= this.USAGE_LIMIT)){
            return { error: {
                status: 403,
                error: 'Forbidden',
                message: 'You dont have enough credits. Recharge or wait a few minutes before trying again.'
            }};
        }

        return true;
    },

    reduceCredit: async function(keyId, usage, credit) {
        if (keyId && (usage.apiKey >= this.USAGE_LIMIT || usage.ip >= this.USAGE_LIMIT)){
            // reduce credits
            credit -= this.REQUEST_COST;
            const [rows, error] = await db.update('api_keys', {credit: credit}, `id = ?`, [keyId]);
    
            if (error){
                return { error: {
                    status: 500,
                    error: 'Internal Server Error',
                    message: 'Error while trying to update credits for api key usage.',
                    serverMessage: error,
                }};
            }
        }

        return true;    
    },

    automate: async function({ key, origin, ip, endpoint, action, version, network, source }) {
        let resp = {};
        const sqlData = {};
        let credit = 0;
    
        if (key){
            const keyRow = await this.getKeyInfo(key);
            if (keyRow.error){
                return { error: keyRow.error };
            }

            resp = this.validateOrigin(keyRow.origin, origin);
            if (resp.error) {
                return { error: resp.error };
            }
    
            sqlData.apiKey = keyRow.result.id;
            credit = keyRow.result.credit;
        }
    
        const usage = await this.getUsage(sqlData.apiKey, ip);
        if (usage.error){
            return { error: usage.error };
        }
    
        resp = this.authorizeKey(key, ip, usage, credit);
        if (resp.error){
            return { error: resp.error };
        }

        const actionResp = await action.run(action.data);
        if (actionResp.error){
            return { error: actionResp.error };
        }

        if (key) {
            resp = await this.reduceCredit(sqlData.apiKey, usage, credit);
            if (resp.error){
                return { error: resp.error };
            }
        }

        sqlData.endpoint = endpoint;
        sqlData.version = version;
        sqlData.network2 = networkList[network].dbid;

        const sourceId = { api: 0, extension: 1, bot: 2 };
        sqlData.source = sourceId[source] || 0;

        if (ip){
            sqlData.ip = ip;
        }
        if (origin){
            sqlData.origin = origin;
        }
    
        resp = await this.recordRequest(sqlData);
        if (resp.error){
            return { error: resp.error };
        }

        return actionResp;
    },

    recordRequest: async function(data) {
        // save API request to DB for statistics purpose
        const [rows, error] = await db.insert('api_requests', data);
        if (error){
            return { error: {
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to record api request into the database.',
                serverMessage: error,
            }};
        }

        return rows;
    },

    // the old update credit. will stay active for a while
    updateCreditLegacy: async function({ id, wallet, timeChecked, credit }){
        const now = parseInt(new Date().getTime() / 1000);
        const then = parseInt(new Date(timeChecked).getTime() / 1000 - 3600);
        const data = {};
        data.api_keys = { credit: credit };
        data.api_keys.timeChecked = new Date();

        // const txs = await oracle.getTx(wallet, parseInt(new Date(timeChecked).getTime() / 1000), now);
        const txsn = [
            // get normal txs
            ...await Promise.all(Object.keys(networkList).map(async network => {
                const tx = await explorer.getTx({ wallet: wallet, fromTime: then, toTime: now, network: network });
                tx.network2 = networkList[network].dbid;
                return tx;
            })),
            // get internal txs
            ...await Promise.all(Object.keys(networkList).map(async network => {
                const tx = await explorer.getTx({ wallet: wallet, fromTime: then, toTime: now, network: network, internal: true });
                tx.network2 = networkList[network].dbid;
                return tx;
            }))
        ];
        // if (txsn.map(e => e.result.length).reduce((p,c) => p+c, 0) > 0){

        data.credit_recharges = {};
        data.credit_recharges.fields = [
            'network2',
            'tx',
            'value',
            'price',
            'timestamp',
            'fromWallet',
            'apiKey',
        ];
        data.credit_recharges.values = [];
        let rechargeAmount = 0;
    
        await Promise.all(txsn.map(async txs => {
            if (txs.status == "1"){
                // check for existing txs
                const hashes = txs.result.map(tx => tx.hash);
                const sql = `SELECT tx FROM credit_recharges WHERE tx IN(${hashes.map(() => '?').join(',')})`;
                const [rows, error] = await db.query(sql, hashes);

                if (error){
                    return { error: {
                        status: 500,
                        error: 'Internal Server Error',
                        message: 'Error while retrieving transactions from database.',
                        serverMessage: error,
                    }};
                }

                // remove existing txs
                txs.result = txs.result.filter(e => !rows.map(r => r.tx).includes(e.hash));

                return Promise.all(txs.result.map(async tx => {
                    // get closest block available on history. get token_price from it
                    const blockNumber = parseInt(tx.blockNumber);
                    const sql = `SELECT token_price, ABS(last_block - ?) AS "block_diff" FROM price_history WHERE network2 = ? ORDER BY ABS(last_block - ?) LIMIT 1`;
                    const [rows, error] = await db.query(sql, [ blockNumber, txs.network2, blockNumber ]);
            
                    if (error){
                        return { error: {
                            status: 500,
                            error: 'Internal Server Error',
                            message: 'Error while retrieving price history information from database.',
                            serverMessage: error,
                        }};
                    }
    
                    const priceThen = parseFloat(rows[0].token_price);
    
                    if (tx.isError == "0" && tx.to.toLowerCase() == wallet.toLowerCase()){
                        // update price using tx value (it is in gwei, convert to ether) * price value at that time.
                        const value = parseInt(tx.value.slice(0,-9));
                        rechargeAmount += (value * 0.000000001 * priceThen);
                        data.api_keys.credit = parseFloat(credit) + (value * 0.000000001 * priceThen);

                        // insert only if tx not duplicate in the array (internal and regular)
                        if (!data.credit_recharges.values.map(e => e[1]).includes(tx.hash)){
                            data.credit_recharges.values.push([
                                txs.network2,
                                tx.hash,
                                value,
                                priceThen,
                                db.raw(`FROM_UNIXTIME(${tx.timeStamp})`),
                                tx.from,
                                id
                            ]);
                        }
                    }
                }));
            }
            return false;
        }));
        
        db.update('api_keys', data.api_keys, `id = ?`, [id]);
        if (data.credit_recharges.values.length){
            db.insert('credit_recharges', data.credit_recharges.fields, data.credit_recharges.values);
            telegram.alert({
                message: 'Credit recharge',
                token: data.credit_recharges.values.map(e => Object.values(networkList).filter(n => n.dbid == e[0])[0].token), // network
                hash: data.credit_recharges.values.map(e => e[1]), // hash
                value: data.credit_recharges.values.map(e => e[2] * e[3] * 0.000000001), // value * tokenprice
                amount: data.credit_recharges.values.map(e => e[2] * 0.000000001), // value
                fromWallet: data.credit_recharges.values.map(e => e[5]), // from
                toWallet: wallet.toLowerCase(),
            });

            // reset alert status
            const [rows, error] = await db.query(`SELECT id, chatid FROM credit_alerts WHERE active = 1 AND apikey = ?`, [ id ]);

            const chats = [];
            if (!error) {
                rows.forEach(row => {
                    db.update('credit_alerts', { status: '{}' }, `id = ?`, [ row.id ]);

                    if (!chats.includes(row.chatid)) {
                        chats.push(row.chatid);
                    }
                });

                chats.forEach(c => telegram.alert(`✅ Your api key was recharged for $${ rechargeAmount.toFixed(6) }. Thanks!`, { chatId: c, bot: '@owlracle_gas_bot' }) );
            }
        }

        return txsn;
    },

    updateCredit: async function({ id, credit }, transactionHash, network){
        const data = {};
        data.api_keys = { credit: credit };
        data.api_keys.timeChecked = new Date();
        const wallet = configFile.wallet;

        let tx = await explorer.getTx({
            transactionHash: transactionHash,
            network: network,
        });

        if (!tx.result || !tx.result.hash){
            return { error: {
                status: 404,
                error: 'Not Found',
                message: 'The informed transaction could not be found.',
                serverMessage: error,
            }};
        }

        data.credit_recharges = {};
        data.credit_recharges.fields = [
            'network2',
            'tx',
            'value',
            'price',
            'fromWallet',
            'apiKey',
        ];
        data.credit_recharges.values = [];
    
        tx = tx.result;
        // check for existing txs
        const sql = `SELECT tx FROM credit_recharges WHERE tx = ?`;
        const [rows, error] = await db.query(sql, [ tx.hash ]);

        if (error){
            return { error: {
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while retrieving transaction from database.',
                serverMessage: error,
            }};
        }

        if (rows.length > 0) {
            return { error: {
                status: 405,
                error: 'Not allowed',
                message: 'Transaction already in the database.',
                serverMessage: error,
            }};
        }

        const priceThen = await (async () => {
            const blockNumber = parseInt(tx.blockNumber);
            // get closest block available on history. get token_price from it
            const sql = `SELECT token_price, ABS(last_block - ?) AS "block_diff" FROM price_history WHERE network2 = ? ORDER BY ABS(last_block - ?) LIMIT 1`;
            const [rows, error] = await db.query(sql, [ blockNumber, networkList[network].dbid, blockNumber ]);
    
            if (error){
                return { error: {
                    status: 500,
                    error: 'Internal Server Error',
                    message: 'Error while retrieving price history information from database.',
                    serverMessage: error,
                }};
            }

            return parseFloat(rows[0].token_price);
        })();

        if (priceThen.error){
            return priceThen;
        }
        
        if (tx.to.toLowerCase() != wallet.toLowerCase()){
            return { error: {
                status: 403,
                error: 'Forbidden',
                message: 'The informed transaction interact with an unknown wallet address.',
                serverMessage: error,
            }};
        }

        // update price using tx value (it is in gwei, convert to ether) * price value at that time.
        const value = parseInt(parseInt(tx.value).toString().slice(0,-9));
        const tokenAmount = value * 0.000000001;
        const usdAmount = tokenAmount * priceThen;
        const bonus = usdAmount; // double amount for limited time
        data.api_keys.credit = parseFloat(credit) + usdAmount + bonus;

        data.credit_recharges.values.push([
            networkList[network].dbid,
            tx.hash,
            value,
            priceThen,
            tx.from,
            id
        ]);
        
        db.update('api_keys', data.api_keys, `id = ?`, [id]);
        if (data.credit_recharges.values.length){
            db.insert('credit_recharges', data.credit_recharges.fields, data.credit_recharges.values);
            telegram.alert({
                message: 'Credit recharge',
                token: networkList[network].token,
                hash: tx.hash,
                usdAmount: usdAmount,
                tokenAmount: tokenAmount,
                fromWallet: tx.from,
                toWallet: wallet,
            });

            // reset alert status
            const [rows, error] = await db.query(`SELECT id, chatid FROM credit_alerts WHERE active = 1 AND apikey = ?`, [ id ]);

            const chats = [];
            if (!error) {
                rows.forEach(row => {
                    db.update('credit_alerts', { status: '{}' }, `id = ?`, [ row.id ]);

                    if (!chats.includes(row.chatid)) {
                        chats.push(row.chatid);
                    }
                });

                chats.forEach(c => telegram.alert(`✅ Your api key was recharged for $${ usdAmount.toFixed(6) }. Thanks!`, { chatId: c, bot: '@owlracle_gas_bot' }) );
            }
        }

        const resp = {
            status: 200,
            message: 'Recharge success',
            amount: {
                token: tokenAmount,
                usd: usdAmount,
            },
            tx: tx
        };

        if (bonus > 0) {
            resp.bonus = bonus;
        }

        return resp;
    },

    // get old blocks
    getOldData: async function(reqnetwork, fromblock, toblock) {
        network = networkList[reqnetwork].name;
        limit = 1000;
        let startTime;

        const getBatch = async fromblock => {
            try{
                let result = await oracle.getOldBLocks(network, fromblock, limit);
                if (!result || !result.length) {
                    return false;
                }
                if (!startTime){
                    startTime = result[0].timestamp.slice(-1)[0];
                }
                else {
                    const days = ((startTime - result[0].timestamp.slice(-1)[0]) / (3600*24)).toFixed(2);
                    const date = new Date(result[0].timestamp.slice(-1)[0] * 1000).toISOString();
                    console.log(`Read ${days} days in blocks. Now at ${date}`);
                }

                // first get all single instances for each time
                let tokenPrice = Object.fromEntries(result.filter(e => e.timestamp).map(data => {
                    const d = new Date(data.timestamp.slice(-1)[0] * 1000);
                    const formattedDate = `${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}`;
                    return [ formattedDate, null ];
                }));

                // then make a request for each singular time
                Object.keys(tokenPrice).forEach(e => {
                    const fetchPrice = async (date, resolve) => {
                        try {
                            let tokenPrice = await (await fetch(`https://api.coingecko.com/api/v3/coins/${networkList[reqnetwork].cgid}/history?date=${date}&localization=false`)).json();
                            tokenPrice = tokenPrice.market_data.current_price.usd;
                            resolve(tokenPrice);
                        }
                        catch (error) {
                            console.log(`Token Price fetch error. Trying again in 60 secs... Date: ${date}`);
                            console.log(error);
                            setTimeout(() => fetchPrice(date, resolve), 30000);
                        }                            
                    };

                    tokenPrice[e] = new Promise(async resolve => await fetchPrice(e, resolve));
                });

                tokenPrice = Object.fromEntries((await Promise.all(Object.values(tokenPrice))).map((e,i) => [Object.keys(tokenPrice)[i], e]));

                result = result.map(data => {
                    if (data.minGwei){
                        const avgTime = (data.timestamp.slice(-1)[0] - data.timestamp[0]) / (data.timestamp.length - 1);
                        // how many blocks to fetch next time
                        const blocks = parseInt(60 / avgTime + 1);
            
                        if (data.minGwei.length > blocks){
                            data.avgGas = data.avgGas.slice(-blocks);
                            data.minGwei = data.minGwei.slice(-blocks);
                        }
            
                        const avgGas = data.avgGas.reduce((p, c) => p + c, 0) / data.avgGas.length;
                                
                        const d = new Date(data.timestamp.slice(-1)[0] * 1000);
                        const formattedDate = `${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}`;
        
                        const dbInfo = {
                            network2: networkList[reqnetwork].dbid,
                            last_block: data.lastBlock,
                            token_price: tokenPrice[formattedDate],
                            avg_gas: avgGas,
                            open: data.minGwei[0],
                            close: data.minGwei.slice(-1)[0],
                            low: Math.min(...data.minGwei),
                            high: Math.max(...data.minGwei),
                            timestamp: db.raw(`FROM_UNIXTIME(${data.timestamp.slice(-1)[0]})`),
                        };

                        db.insert(`price_history`, dbInfo);
                        
                        return dbInfo;
                    }
                });

                return result;
            }
            catch (error) {
                console.log(error);
            }
        }

        const getAllBatches = async (prevBlock, buffer) => {
            if (!buffer){
                buffer = [];
            }

            // if (prevBlock < toblock){
            //     return buffer;
            // }

            const result = await getBatch(prevBlock);
            if (!result) {
                return await getAllBatches(prevBlock - 1, buffer);
            }

            buffer.push(result);
            prevBlock = result.slice(-1)[0].last_block - 1;

            if (result.length > 0){
                return await getAllBatches(prevBlock, buffer);
            }
            return buffer;

        }

        let result = await getAllBatches(fromblock);
        
        // merge all result in a single array
        result = ((data, buffer) => {
            data.forEach(e => buffer.push(...e));
            return buffer;
        })(result, []);

        console.log('DONE');

        return result;
    },

    validateKey: async function(key) {
        const res = {};

        if (!key.match(/^[a-f0-9]{32}$/)){
            res.status = 400;
            res.send = {
                status: 400,
                error: 'Bad Request',
                message: 'The informed api key is invalid.'
            };
            return res;
        }

        let [rows, error] = await db.query(`SELECT * FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);
    
        if (error){
            res.status = 500;
            res.send = {
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to search the database for your api key.',
                serverMessage: error,
            };
            return res;
        }

        const rowsPromise = rows.map(row => bcrypt.compare(key, row.apiKey));
        const row = (await Promise.all(rowsPromise)).map((e,i) => e ? rows[i] : false).filter(e => e);

        if (row.length == 0){
            res.status = 401;
            res.send = {
                status: 401,
                error: 'Unauthorized',
                message: 'Could not find the provided api key.'
            };
            return res;
        }

        res.status = 200;
        res.send = row[0];

        return res;
    },
}