const { db } = require('./database');
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
        if (password == configFile.mysql.connection.password) {
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

        // get min timestamp
        let [rows, error] = await db.query(`SELECT UNIX_TIMESTAMP(now()) - UNIX_TIMESTAMP(MIN(timestamp)) AS max_seconds FROM api_requests;`, []);
        const maxSec = rows[0].max_seconds;

        const requests = [];
        let i = 0;
        do {
            const sql = `SELECT timestamp, count(*) AS 'requests' FROM api_requests WHERE timestamp BETWEEN NOW() - INTERVAL ? SECOND AND NOW() - INTERVAL ? SECOND ${network ? `AND network2 = ?` : ''};`;
            const data = [ timeframe * (i+1), timeframe * i ];
            i++;
            
            if (network) {
                data.push(networkList[network].dbid);
            }
    
            // can make requests in parallel
            requests.push(db.query(sql, data));
        } while( timeframe * (i+1) < maxSec );

        const responses = await Promise.all(requests);
        const samples = responses.filter(([rows, error]) => !error && rows.length && rows[0].timestamp).map(([rows,_]) => rows[0]);

        res.send({
            message: 'success',
            results: samples,
        });
    });

    
    // get api credit
    app.get('/admin/credit', async (req, res) => {

        // get all api key ids
        let ids = await (async id => {
            if (id) {
                return [id];
            }

            const [rows, error] = await db.query(`SELECT id FROM api_keys`, []);
            if (error) {
                return {
                    status: 500,
                    error: 'Internal server error',
                    message: 'Error retrieving the api key information'
                };
            }

            return rows.map(e => e.id);
        })(req.query.id);
        // console.log(ids)

        if (ids.error) {
            res.status(500).send(ids);
            return;
        }

        const results = ids.map(async id => {
            // get usage
            let sql = `SELECT count(*) AS key_usage FROM api_requests WHERE apiKey = ? AND timestamp > now() - INTERVAL 1 DAY`;
            let [rows, error] = await db.query(sql, [id]);
            // console.log(db.format(sql, [id]));
            if (error) {
                return {
                    status: 500,
                    error: 'Internal server error',
                    message: 'Error retrieving the api key information'
                }
            }
    
            // get key info
            const usage = rows.map(e => e.key_usage);
            sql = `SELECT k.id, k.origin, k.note, k.credit, k.timeChecked FROM api_keys k WHERE k.id = ?`;
            [rows, error] = await db.query(sql, [id]);
            // console.log(db.format(sql, [id]));
            if (error) {
                return {
                    status: 500,
                    error: 'Internal server error',
                    message: 'Error retrieving the api key information'
                };
            }

            rows[0]['key_use'] = usage;

            return rows[0];
        });

        const data = await Promise.all(results);

        // check for error in any result
        const errors = data.filter(e => e.error);
        if (errors.length) {
            res.status(500).send(errors);
            return;
        }

        // sort data
        data.sort((a,b) => {
            let first = b;
            let last = a;
            const field = {
                usage: 'key_use',
                credit: 'credit',
                time: 'timeChecked'
            }

            if (req.query.order == 'asc') {
                first = a;
                last = b;
            }

            return first[field[req.query.field]] - last[field[req.query.field]];
        });

        res.send({
            message: 'success',
            results: data,
        })
    });
};