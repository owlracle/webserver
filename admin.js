const db = require('./database');
const { configFile, Session, explorer } = require('./utils');

module.exports = app => {
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

        if (network) {
            data.push(network);
        }

        data.push(timeframe);

        const sql = `SELECT timestamp, count(*) AS 'requests' FROM api_requests ${network ? `WHERE network = ?` : ''} GROUP BY UNIX_TIMESTAMP(timestamp) DIV ? ORDER BY timestamp DESC`;
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
        sql = `SELECT token_price, network FROM price_history WHERE id IN (SELECT MAX(id) FROM price_history GROUP BY network);`;
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

        const tokenPrices = Object.fromEntries(rows.map(row => [row.network, row.token_price]));
    
        res.send({
            message: 'success',
            balances: balances,
            tokenPrices: tokenPrices,
        });
    });
};