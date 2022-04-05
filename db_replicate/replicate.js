const fs = require('fs');
const cors = require('cors');
const { configFile } = require('../utils');
const db = require('../database');


const replicate = {
    fileName: 'mysqlUpdate.json',
    endpoint: 'dbsync',

    saveUpdate: function(table, sql, data) {
        const config = configFile.mysql.replicate;
        if (!config.enabled || !config.saveUpdates) {
            return;
        }

        const path = `${__dirname}/${this.fileName}`;
        const file = fs.existsSync(path) ?
            JSON.parse(fs.readFileSync(path)) : [];

        const query = this.format(sql, data);
        file.push({
            timestamp: new Date().getTime(),
            table: table,
            query: query,
        });

        fs.writeFileSync(path, JSON.stringify(file));
    },

    replicate: async function() {
        const config = configFile.mysql.replicate;
        if (!config.enabled || !config.writeLocal) {
            return;
        }
        
        let res = await fetch(`${config.sourceURL}/${this.endpoint}`);
        const file = await res.json();
        
        while (file.length) {
            console.log(file)
            const query = file.shift().query;
            db.query(query, []);
        }

        return;
    },

    createWorker: function(app) {
        const config = configFile.mysql.replicate;
        if (!config.enabled) {
            return;
        }

        // expose updates file
        if (config.saveUpdates) {
            const corsOptions = {
                origin: '*',
                optionsSuccessStatus: 200,
            };
    
            app.get(`/${this.endpoint}`, cors(corsOptions), async (req, res) => {
                const path = `${__dirname}/${this.fileName}`;
                const file = JSON.parse(fs.readFileSync(path));
                fs.writeFileSync(path, JSON.stringify([]));
                res.send(file);
            });
        }

        // save to local db
        if (config.writeLocal) {
            const rpl = async () => {
                await this.replicate();
                setTimeout(async () => await rpl(), 100);
                return;
            }
            rpl();
        }
        
    },
};

module.exports = replicate;