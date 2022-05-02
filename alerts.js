const { db } = require('./database');

module.exports = (app, api) => {
    // add credit alert
    app.post('/alert/credit/:key', async (req, res) => {
        const key = req.params.key;

        const keyData = await api.validateKey(key);
        if (keyData.status != 200) {
            res.status(keyData.status).send(keyData.send);
            return;
        }

        const keyId = keyData.send.id;
        // check if there is already an alert for this key-chat pair
        [rows, error] = await db.query(`SELECT * FROM credit_alerts WHERE apikey = ?`, [ keyId ]);

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

        // console.log(rows)

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

        const keyData = await api.validateKey(key);
        if (keyData.status != 200) {
            res.status(keyData.status).send(keyData.send);
            return;
        }

        const keyId = keyData.send.id;
        // check if there is already an alert for this key-chat pair
        [rows, error] = await db.query(`SELECT * FROM credit_alerts WHERE apikey = ? AND active = 1`, [ keyId ]);

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
            res.status(404);
            res.send({
                status: 404,
                error: 'Not Found',
                message: 'There is no alert for this key.'
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
    app.get('/alert/credit/:key', async (req, res) => {
        const keyData = await api.validateKey(req.params.key);
        if (keyData.status != 200) {
            res.status(keyData.status).send(keyData.send);
            return;
        }

        const id = keyData.send.id;
        
        let [rows, error] = await db.query(`SELECT k.credit, k.chatid, a.active FROM credit_alerts a INNER JOIN api_keys k ON k.id = a.apikey WHERE a.apikey = ? AND a.active = 1`, [ id ]);
    
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

        if (!rows.length) {
            res.send({ status: 'empty' });
            return;
        }

        res.send({
            status: 'success',
            apiKey: req.params.key,
            chatId: rows[0].chatid,
            credit: rows[0].credit,
        });

        return;
    });
};