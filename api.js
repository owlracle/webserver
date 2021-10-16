const fetch = require('node-fetch');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');


const { Session, verifyRecaptcha, requestOracle, networkList } = require('./utils');
const db = require('./database');


const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200,
};


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

            // accept and blocks only work when using v2
            const defaultSpeeds = [35, 60, 90, 100];
            const version = parseInt(req.query.version) || 2;
            const blocks = req.query.blocks && version == 2 ? Math.min(Math.max(parseInt(req.query.blocks), 0), 1000) : 200;
            const accept = req.query.accept && version == 2 ? req.query.accept.split(',').map(e => Math.min(Math.max(parseInt(e), 0), 100)) : defaultSpeeds;
    
            const data = await requestOracle(network.name, blocks);
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
                const tokenPrice = parseFloat(JSON.parse(fs.readFileSync(`${__dirname}/tokenPrice.json`)).filter(e => e.symbol == `${network.token}USDT`)[0].price);

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
        
            candles = Math.max(Math.min(candles || 1000, 1000), 1);
            const offset = (parseInt(page) - 1) * candles || 0;

            const sql = `SELECT GROUP_CONCAT(p.open) AS 'open', GROUP_CONCAT(p.close) AS 'close', GROUP_CONCAT(p.low) AS 'low', GROUP_CONCAT(p.high) AS 'high', GROUP_CONCAT(p.token_price) AS 'tokenprice', MAX(p.timestamp) AS 'timestamp', count(p.id) AS 'samples', GROUP_CONCAT(p.avg_gas) AS 'avg_gas' FROM price_history p WHERE network = ? AND UNIX_TIMESTAMP(timestamp) BETWEEN ? AND ? GROUP BY UNIX_TIMESTAMP(timestamp) DIV ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
            // console.log(sql)
            const data = [
                network,
                from || 0,
                to || new Date().getTime() / 1000,
                timeframe * 60,
                candles,
                offset,
            ];
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
            const wallet = await (await fetch('https://api.blockcypher.com/v1/eth/main/addrs', { method: 'POST' })).json();
            
            const data = {
                apiKey: hash[0],
                secret: hash[1],
                wallet: `0x${wallet.address}`,
                private: wallet.private,
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
    
            // get block height now so I know where to start looking for transactions
            // data.blockChecked = parseInt(await bscscan.getBlockHeight());
    
            // if (isNaN(data.blockChecked)){
            //     res.status(500);
            //     res.send({
            //         status: 500,
            //         error: 'Internal Server Error',
            //         message: 'Error getting network block height',
            //         serverMessage: data.blockChecked,
            //     });
            // }
    
            const [rows, error] = await db.insert('api_keys', data);
        
            if (error){
                res.status(500);
                res.send({
                    status: 500,
                    error: 'Internal Server Error',
                    message: 'Error while trying to insert new api key to database',
                    serverMessage: error,
                });
            }
            else {
                res.send({
                    apiKey: key,
                    secret: secret,
                    wallet: data.wallet,
                });
            }
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
    
        if (!key.match(/^[a-f0-9]{32}$/)){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'The informed api key is invalid.'
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
                const row = (await Promise.all(rows.map(row => bcrypt.compare(key, row.apiKey)))).map((e,i) => e ? rows[i] : false).filter(e => e);
        
                if (row.length == 0){
                    res.status(401);
                    res.send({
                        status: 401,
                        error: 'Unauthorized',
                        message: 'Could not find your api key.'
                    });
                }
                else {
                    const id = row[0].id;
                    const toTime = req.query.totime || db.raw('UNIX_TIMESTAMP(now())');
                    const fromTime = req.query.fromtime || (req.query.totime ? parseInt(req.query.totime) - 3600 : db.raw('UNIX_TIMESTAMP(now()) - 3600'));
    
                    const sql = `SELECT ip, origin, timestamp, endpoint, network FROM api_requests WHERE UNIX_TIMESTAMP(timestamp) >= ? AND UNIX_TIMESTAMP(timestamp) <= ? AND apiKey = ? ORDER BY timestamp DESC LIMIT 10000`;
                    const sqlData = [
                        fromTime,
                        toTime,
                        id,
                    ];
                    const [rows, error] = await db.query(sql, sqlData);
    
                    if (error){
                        res.status(500);
                        res.send({
                            status: 500,
                            error: 'Internal Server Error',
                            message: 'Error while trying to fetch your logs.',
                            serverMessage: error,
                        });
                    }
                    else {
                        res.send(rows);
                    }
                }
            }
        }
    
    });
    
    
    // get api key info
    app.get('/keys/:key', cors(corsOptions), async (req, res) => {
        const key = req.params.key;
    
        if (!key.match(/^[a-f0-9]{32}$/)){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'The informed api key is invalid.'
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
            else {
                const row = (await Promise.all(rows.map(row => bcrypt.compare(key, row.apiKey)))).map((e,i) => e ? rows[i] : false).filter(e => e);
        
                if (row.length == 0){
                    res.status(401);
                    res.send({
                        status: 401,
                        error: 'Unauthorized',
                        message: 'Could not find your api key.'
                    });
                }
                else {
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
        
                    const hourApi = `SELECT count(*) FROM api_requests WHERE apiKey = ${id} AND timestamp >= now() - INTERVAL 1 HOUR`;
                    const totalApi = `SELECT count(*) FROM api_requests WHERE apiKey = ${id}`;
                    // let hourIp = 'SELECT 0';
                    // let totalIp = 'SELECT 0';
    
                    const queryData = [];
        
                    // if (req.header('x-real-ip')){
                    //     const ip = req.header('x-real-ip');
                    //     hourIp = `SELECT count(*) FROM api_requests WHERE ip = ? AND timestamp >= now() - INTERVAL 1 HOUR`;
                    //     totalIp = `SELECT count(*) FROM api_requests WHERE ip = ?`;
                    //     queryData.push(ip, ip);
                    // }
        
        
                    // const [rows, error] = await db.query(`SELECT (${hourApi}) AS hourapi, (${hourIp}) AS hourip, (${totalApi}) AS totalapi, (${totalIp}) AS totalip`, queryData);
                    const [rows, error] = await db.query(`SELECT (${hourApi}) AS hourapi, (${totalApi}) AS totalapi`, queryData);
    
                    if (error){
                        res.status(500);
                        res.send({
                            status: 500,
                            error: 'Internal Server Error',
                            message: 'Error while trying to search the database for your api key.',
                            serverMessage: error,
                        });
                    }
                    else {
                        data.usage = {
                            apiKeyHour: rows[0].hourapi,
                            // ipHour: rows[0].hourip,
                            apiKeyTotal: rows[0].totalapi,
                            // ipTotal: rows[0].totalip,
                        };
    
                        res.send(data);
                    }
                }
            }
        }
    });
    
    
    // request credit info
    app.get('/credit/:key', cors(corsOptions), async (req, res) => {
        // const key = req.params.key;
    
        // if (!key.match(/^[a-f0-9]{32}$/)){
        //     res.status(400);
        //     res.send({
        //         status: 400,
        //         error: 'Bad Request',
        //         message: 'The informed api key is invalid.'
        //     });
        // }
        // else {
        //     const [rows, error] = await db.query(`SELECT * FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);
    
        //     if (error){
        //         res.status(500);
        //         res.send({
        //             status: 500,
        //             error: 'Internal Server Error',
        //             message: 'Error while trying to search the database for your api key.',
        //             serverMessage: error,
        //         });
        //     }
        //     else {
        //         const row = (await Promise.all(rows.map(row => bcrypt.compare(key, row.apiKey)))).map((e,i) => e ? rows[i] : false).filter(e => e);
        
        //         if (row.length == 0){
        //             res.status(401);
        //             res.send({
        //                 status: 401,
        //                 error: 'Unauthorized',
        //                 message: 'Could not find your api key.'
        //             });
        //         }
        //         else {
        //             const [rows, error] = await db.query(`SELECT network, tx, timestamp, value, fromWallet FROM credit_recharges WHERE apiKey = ? ORDER BY timestamp DESC`, [ row[0].id ]);
    
        //             if (error){
        //                 res.status(500);
        //                 res.send({
        //                     status: 500,
        //                     error: 'Internal Server Error',
        //                     message: 'Error while retrieving your credit information.',
        //                     serverMessage: error,
        //                 });
        //             }
        //             else {
        //                 res.send({
        //                     message: 'success',
        //                     results: rows
        //                 });
        //             }
        //         }
        //     }
        // }
        res.send({
            status: 404,
            error: 'Not found',
            message: 'This endpoint is not available right now.'
        })

    });
    
    
    // update credit
    app.put('/credit/:key', async (req, res) => {
        // const key = req.params.key;
    
        // if (!key.match(/^[a-f0-9]{32}$/)){
        //     res.status(400);
        //     res.send({
        //         status: 400,
        //         error: 'Bad Request',
        //         message: 'The informed api key is invalid.'
        //     });
        // }
        // else {
        //     const [rows, error] = await db.query(`SELECT * FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);
    
        //     if (error){
        //         res.status(500);
        //         res.send({
        //             status: 500,
        //             error: 'Internal Server Error',
        //             message: 'Error while trying to search the database for your api key.',
        //             serverMessage: error,
        //         });
        //     }
        //     else {
        //         const row = (await Promise.all(rows.map(row => bcrypt.compare(key, row.apiKey)))).map((e,i) => e ? rows[i] : false).filter(e => e);
        
        //         if (row.length == 0){
        //             res.status(401);
        //             res.send({
        //                 status: 401,
        //                 error: 'Unauthorized',
        //                 message: 'Could not find your api key.'
        //             });
        //         }
        //         else {
        //             // const blockHeight = (await requestOracle(network.name, 1)).lastBlock;
        //             // const txs = await api.updateCredit(row[0], blockHeight);
        //             // res.send(txs);
        //         }
        //     }
        // }

        res.send({
            status: 404,
            error: 'Not found',
            message: 'This endpoint is not available right now.'
        })
    });

    return api;
}


const api = {
    USAGE_LIMIT: 100,
    REQUEST_COST: 10000,

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
        if (!key){
            return { error: {
                status: 401,
                error: 'Unauthorized',
                message: 'You must provide an api key for this action.'
            }};
        }
        else if (credit < 0 && (usage.apiKey >= this.USAGE_LIMIT || usage.ip >= this.USAGE_LIMIT)){
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

    automate: async function({ key, origin, ip, endpoint, action, version, network }) {
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

        resp = await this.reduceCredit(sqlData.apiKey, usage, credit);
        if (resp.error){
            return { error: resp.error };
        }

        sqlData.endpoint = endpoint;
        sqlData.version = version;
        sqlData.network = network;

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

    // updateCredit: async function({id, wallet, blockChecked, credit}, blockHeight, network){
    //     const block = blockChecked + 1;

    //     const data = {};
    //     data.api_keys = { credit: credit };
    //     data.api_keys.blockChecked = blockHeight;
        
    //     const txs = await bscscan.getTx(wallet, block, blockHeight);

    //     data.credit_recharges = {};
    //     data.credit_recharges.fields = [
    //         'network',
    //         'tx',
    //         'value',
    //         'timestamp',
    //         'fromWallet',
    //         'apiKey',
    //     ];
    //     data.credit_recharges.values = [];
    
    //     if (txs.message == "success"){
    //         txs.txs.forEach(async tx => {
    //             data.api_keys.credit = parseFloat(data.api_keys.credit) + tx.value;

    //             let network = Object.entries(networkList).filter(([key, value]) => value.name == tx.network);
    //             network = network.length ? network[0][0] : null;

    //             data.credit_recharges.values.push([
    //                 network,
    //                 tx.tx,
    //                 tx.value,
    //                 db.raw(`FROM_UNIXTIME(${tx.timeStamp})`),
    //                 tx.from,
    //                 id
    //             ]);
    //         });
    //     }
        
    //     db.update('api_keys', data.api_keys, `id = ?`, [id]);
    //     if (data.credit_recharges.values.length){
    //         db.insert('credit_recharges', data.credit_recharges.fields, data.credit_recharges.values);
    //     }

    //     return txs;
    // }
}

