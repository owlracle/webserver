const db = require('./database');
const { configFile, Session, explorer, networkList } = require('./utils');

module.exports = (app, api) => {
    // admin login
    app.post('/admin/login', (req, res) => {
        if (!configFile.production) {
            res.send({
                message: 'Bypassing session for dev mode',
                sessionId: 'dev-session',
            });
            return;
        }

        if (req.body.currentSession) {
            const session = Session.getInstance(req.body.currentSession);

            if (session) {
                session.refresh();
                res.send({
                    message: 'Session accepted',
                    sessionId: session.getId(),
                    expireAt: session.getExpireAt(),
                });
                return;
            }

            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Your session token is invalid.',
            });
            return;
        }

        const password = req.body.password;
        if (password == configFile.mysql.password) {
            const session = new Session(1000 * 3600); // 1 hour session
            res.send({
                message: 'Logged in',
                sessionId: session.getId(),
                expireAt: session.getExpireAt(),
            });
            return;
        }

        res.status(401);
        res.send({
            status: 401,
            error: 'Unauthorized',
            message: 'Invalid password.',
        });
        return;
    });

    // request api key requests
    app.get('/admin/requests', async (req, res) => {
        const session = Session.getInstance(req.query.currentSession || false);

        if (!session) {
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Your session token is invalid.',
            });
            return;
        }

        session.refresh();

        let timeframe = req.query.timeframe || 3600;
        const network = req.query.network;

        if (typeof timeframe === 'string') {
            const nickFrame = { M: 2592000, d: 86400, h: 3600, m: 60 };
            timeframe = nickFrame[timeframe] || 3600;
        }

        const data = [];
        data.push(timeframe);
        data.push(timeframe);

        if (network) {
            data.push(networkList[network].dbid);
        }

        data.push(timeframe);

        // remove last unfinished timeframe from chart
        const cutLast = `UNIX_TIMESTAMP(timestamp) DIV ? != UNIX_TIMESTAMP(now()) DIV ?`;
        const sql = `SELECT timestamp, count(*) AS 'requests' FROM api_requests WHERE ${cutLast} ${network ? `AND network2 = ?` : ''} GROUP BY UNIX_TIMESTAMP(timestamp) DIV ? ORDER BY timestamp DESC`;
        const [rows, error] = await db.query(sql, data);

        if (error) {
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error while trying to read api requests'
            });
            return;
        }

        res.send({
            message: 'success',
            results: rows,
        });
    });


    // wallet balances
    app.get('/admin/wallets', async (req, res) => {
        // session check
        const session = Session.getInstance(req.query.currentSession || false);

        if (!session) {
            res.status(401);
            res.send({
                status: 401,
                error: 'Unauthorized',
                message: 'Your session token is invalid.',
            });
            return;
        }

        session.refresh();

        // get wallets available
        let sql = `SELECT wallet, private FROM api_keys;`;
        let [rows, error] = await db.query(sql, []);

        if (error) {
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error retrieving api keys stats.'
            });
            return;
        }

        // get balance from explorer
        const wallets = rows.map(row => row.wallet);
        const balances = await explorer.getMultiBalance(wallets);
        rows.forEach(e => balances[e.wallet].private = e.private);

        // get last token price for every network
        sql = `SELECT token_price, n.symbol AS network FROM price_history p INNER JOIN networks n ON n.id = p.network2 WHERE p.id IN (SELECT MAX(id) FROM price_history GROUP BY network2);`;
        [rows, error] = await db.query(sql, []);

        if (error) {
            res.status(500);
            res.send({
                status: 500,
                error: 'Internal Server Error',
                message: 'Error retrieving token prices.'
            });
            return;
        }

        const tokenPrices = Object.fromEntries(rows.map(row => [ row.network, row.token_price ]));
    
        res.send({
            message: 'success',
            balances: balances,
            tokenPrices: tokenPrices,
        });
    });


    // get api credit
    app.get('/admin/credit', async (req, res) => {
        const data = [];
        let filter = '';
        if (req.query.wallet) {
            filter = ' WHERE wallet = ?';
            data.push(req.query.wallet);
        }
        else if (req.query.id) {
            filter = ' WHERE id = ?';
            data.push(req.query.id);
        }

        let orderBy = 'key_use DESC';
        const field = { credit: 'k.credit', usage: 'key_use', time: 'k.timeChecked' };
        if (req.query.field && field[req.query.field]){
            const order = req.query.order && req.query.order == 'desc' ? 'DESC' : 'ASC';
            orderBy = `${field[req.query.field]} ${order}`;
        }

        const limit = 25;
        const offset = req.query.page * limit;

        const usage = `SELECT count(*) FROM api_requests WHERE timestamp > now() - INTERVAL 1 DAY AND apiKey = k.id`;
        const [rows, error] = await db.query(`SELECT k.id, k.origin, k.note, k.credit, k.wallet, (${usage}) AS key_use, k.timeChecked FROM api_keys k${filter} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`, data);

        if (error) {
            res.status(500).send({
                status: 500,
                error: 'Internal server error',
                message: 'Error retrieving the api key information'
            });
            return;
        }

        res.send({
            message: 'success',
            results: rows,
        })
    });


    // update api credit
    app.put('/admin/credit', async (req, res) => {
        const data = [];
        let filter = '';
        if (req.body.wallet) {
            filter = ' WHERE wallet = ?';
            data.push(req.body.wallet.toLowerCase());
        }
        else if (req.body.id) {
            filter = ' WHERE id = ?';
            data.push(req.body.id);
        }

        const [rows, error] = await db.query(`SELECT * FROM api_keys${filter} ORDER BY timeChecked`, data);

        if (error) {
            res.status(500).send({
                status: 500,
                error: 'Internal server error',
                message: 'Error retrieving the api key information'
            });
            return;
        }

        // wait before every api update so we dont overload the explorers
        const resp = {};
        for (let i=0 ; i < rows.length ; i++){
            resp[rows[i].id] = await api.updateCredit(rows[i]);
        }

        res.send({ message: 'success', keys: resp });
    });
};