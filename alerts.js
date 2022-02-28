const db = require('./database');
const cors = require('cors');
const bcrypt = require('bcrypt');

const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200,
    methods: 'GET, POST, DELETE',
};

module.exports = (app, api) => {
    // add credit alert
    app.post('/alert/credit/:key', cors(corsOptions), async (req, res) => {
        const key = req.params.key;
        const chatId = req.body.chatid;

        if (!chatId){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'You must provide a chat id.'
            });
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

        const rowsPromise = rows.map(row => bcrypt.compare(key, row.apiKey));
        const row = (await Promise.all(rowsPromise)).map((e,i) => e ? rows[i] : false).filter(e => e);

        if (row.length == 0){
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Could not find the provided api key.'
            });
            return;
        }

        const keyId = row[0].id;
        // check if there is already an alert for this key-chat pair
        [rows, error] = await db.query(`SELECT * FROM credit_alerts WHERE apikey = ? AND chatid = ?`, [ keyId, chatId ]);

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

        if (rows.length > 0){
            if (rows[0].active == "1"){
                res.send({
                    status: 'existing',
                    message: 'credit alert is already active'
                });
                return;
            }

            [rows, error] = await db.update('credit_alerts', { active: 1 }, `id = ?`, [ rows[0].id ]);
            
            res.send({
                status: 'success',
                message: 'credit alert enabled successfully'
            });
            return;
        }

        [rows, error] = await db.insert('credit_alerts', {
            apikey: keyId,
            chatid: chatId
        });

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to insert alert.',
                serverMessage: error,
            });
            return;
        }

        res.send({
            status: 'success',
            message: 'credit alert created successfully'
        });
    });

    // remove credit alert
    app.delete('/alert/credit/:key', cors(corsOptions), async (req, res) => {
        const key = req.params.key;
        const chatId = req.body.chatId;

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

        const rowsPromise = rows.map(row => bcrypt.compare(key, row.apiKey));
        const row = (await Promise.all(rowsPromise)).map((e,i) => e ? rows[i] : false).filter(e => e);

        if (row.length == 0){
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Could not find the provided api key.'
            });
            return;
        }

        const keyId = row[0].id;
        // check if there is already an alert for this key-chat pair
        [rows, error] = await db.query(`SELECT * FROM credit_alerts WHERE apikey = ? AND chatid = ?`, [ keyId, chatId ]);

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

        if (rows.length == 0){
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'This key-chatid pair is not registered.'
            });
            return;
        }

        [rows, error] = await db.update('credit_alerts', { active: 0 }, `id = ?`, [ rows[0].id ]);

        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to update alert.',
                serverMessage: error,
            });
            return;
        }

        res.send({
            status: 'success',
            message: 'credit alert disabled'
        })
    });

    // get info about credit alerts
    app.get('/alert/credit/:chatid', cors(corsOptions), async (req, res) => {
        const chatId = req.params.chatid;

        let [rows, error] = await db.query(`SELECT k.peek, k.credit FROM credit_alerts a INNER JOIN api_keys k ON k.id = a.apikey WHERE a.chatid = ?`, [ chatId ]);
    
        if (error){
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while retrieving alerts information.',
                serverMessage: error,
            });
            return;
        }

        const keys = rows.map(row => {
            return {
                apiKey: row.peek,
                credit: row.credit,
            }
        });

        res.send({
            status: 'success',
            apiKeys: keys,
        })
    });
};