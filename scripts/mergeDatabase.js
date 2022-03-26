// This script is meant to use when you want to move the database to another server seamlessly
// Instructions:
// * Change config.json and set mysql.saveUpdates to true
// * Run a full mysqldump on the database then import to the new destination
// * Get the last timestamp on the backup for the relevant tables
//   * SELECT UNIX_TIMESTAMP(timestamp) FROM api_requests ORDER BY timestamp DESC LIMIT 1;
// * Run this script
//   * node mergeDatabase.js --table TABLE --timestamp TIMESTAMP
//     * timestamp is JS, so multiply db values by 1000
// * Switch config.json to reflect new database location

const fs = require('fs');
const { db } = require('../database');

process.argv.forEach((val, index, array) => {
    let table;
    let timestamp;

    if (val == '--table'){
        table = array[index+1];
    }
    if (val == '--timestamp'){
        timestamp = array[index+1];
    }

    if (table && timestamp) {
        mergeTable(table, timestamp);
    }
});

// table and timestamp provided are retrieved from last in the new database
// SELECT UNIX_TIMESTAMP(timestamp) FROM api_requests ORDER BY timestamp DESC LIMIT 1;
function mergeTable(table, timestamp) {
    db.connect();
    
    const path = `${__dirname}/mysqlUpdate.json`;
    const file = JSON.parse(fs.readFileSync(path));
    
    file.push({
        timestamp: new Date(),
        table: table,
        query: query,
    });

    file.filter(e => e.table == table && e.timestamp > timestamp)
    .forEach(async e => {
        try {
            await db.query(e.query, []);
            console.log(e.query);
        }
        catch (error) {
            console.log(error);
        }
    })
}

