const db = require('./database');
const cors = require('cors');
const bcrypt = require('bcrypt');

const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200,
};

module.exports = (app, api) => {
    // add credit alert
    app.post('/alert/credit/:key', cors(corsOptions), async (req, res) => {
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

        const [rows, error] = await db.query(`SELECT * FROM api_keys WHERE peek = ?`, [ key.slice(-4) ]);
    
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
        const [rows, error] = await db.query(`SELECT * FROM credit_alerts WHERE apikey = ? AND chatid = ?`, [ keyId, chatId ]);

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

        if (row.length > 0){
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'This key-chatid pair is already registered.'
            });
            return;
        }

        const [rows, error] = await db.insert('credit_alerts', {
            apikey: keyId,
            chatid: chatId
        });

        res.send({
            status: 'success',
            message: 'credit alert created successfully'
        })
    });
};