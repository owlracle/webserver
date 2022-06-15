const { db } = require('../database');

db.connect();

(async () => {
    const [data,error] = await db.query(`SELECT * FROM credit_alerts`, []);
    
    data.forEach(row => {
        db.update('api_keys', { chatid: row.chatid }, 'id = ?', [row.apikey] );
    });

    return;
})();