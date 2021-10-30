const db = require('./database');

module.exports = app => {
    app.get('/requests', async (req, res) => {
        let timeframe = req.query.timeframe || 3600;
        const network = req.query.network;

        if (typeof timeframe === 'string'){
            const nickFrame = { M: 2592000, d: 86400, h: 3600, m: 60 };
            timeframe = nickFrame[timeframe] || 3600;
        }

        const data = [];

        if (network){
            data.push(network);
        }

        data.push(timeframe);

        const sql = `SELECT timestamp, count(*) AS 'requests' FROM api_requests ${network ? `WHERE network = ?` : ''} GROUP BY UNIX_TIMESTAMP(timestamp) DIV ? ORDER BY timestamp DESC`;
        const [rows, error] = await db.query(sql, data);

        if (error){
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
};