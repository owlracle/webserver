const db = require('./database');
const bcrypt = require('bcrypt');

module.exports = (app, api) => {
    // add credit alert
    app.post('/alert/credit/:key', async (req, res) => {
        const key = req.params.key;
        const chatId = req.body.chatid || '';

        if (!chatId){
            res.status(400);
            res.send({
                status: 400,
                error: 'Bad Request',
                message: 'You must provide a chat id.'
            });
            return;
        }

        const keyData = await api.validateKey(key);
        if (keyData.status != 200) {
            res.status(keyData.status).send(keyData.send);
            return;
        }

        const keyId = keyData.apiKey.id;
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
    app.delete('/alert/credit/:key', async (req, res) => {
        const key = req.params.key;
        const chatId = req.body.chatid || '';

        const keyData = await api.validateKey(key);
        if (keyData.status != 200) {
            res.status(keyData.status).send(keyData.send);
            return;
        }

        const keyId = keyData.apiKey.id;
        // check if there is already an alert for this key-chat pair
        [rows, error] = await db.query(`SELECT * FROM credit_alerts WHERE apikey = ? AND chatid = ? AND active = 1`, [ keyId, chatId ]);

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
    app.get('/alert/credit/:id', async (req, res) => {
        let id = req.params.id;
        const field = id.match(/^[a-f0-9]{32}$/) ? 'apikey' : 'chatid';

        // informed field is apikey hash
        if (field == 'apikey') {
            const keyData = await api.validateKey(id);
            if (keyData.status != 200) {
                res.status(keyData.status).send(keyData.send);
                return;
            }
    
            id = keyData.send.id;
        }
        
        let [rows, error] = await db.query(`SELECT k.peek, k.credit, a.chatid FROM credit_alerts a INNER JOIN api_keys k ON k.id = a.apikey WHERE a.${field} = ?`, [ id ]);
    
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
                chatId: row.chatid,
                credit: row.credit,
            }
        });

        res.send({
            status: 'success',
            apiKeys: keys,
        });

        return;
    });
};