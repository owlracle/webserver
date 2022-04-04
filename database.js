const mysql = require('mysql2');
const fs = require('fs');
const fetch = require('node-fetch');

const { configFile, telegram } = require('./utils');

const db = {
    working: false,

    query: async function(sql, data) {
        [sql, data] = this.formatRaw(sql, data);
        // console.log(sql, data);
        // console.log(this.format(sql, data));
        return new Promise(resolve => this.connection.execute(sql, data, (error, rows) => {
            // console.log(error)
            if (error && error.fatal){
                if (this.working){
                    telegram.alert({
                        message: 'Mysql error',
                        error: error,
                    });
                }
                
                this.working = false;

                this.connect();
                setTimeout(async () => resolve(await this.query(sql, data)), 1000);
            }
            else{
                resolve([rows, error]);
            }
        }));
    },

    insert: async function(table, fields, values){
        // if sent object, convert to array
        if (typeof fields === 'object' && !Array.isArray(fields)){
            values = Object.values(fields);
            fields = Object.keys(fields);
        }

        // if sent multiple rows to be inserted
        if (Array.isArray(values[0]) && values[0].length == fields.length){
            return Promise.all(values.map(value => this.insert(table, fields, value)));
        }
        else {
            let sql = `INSERT INTO ${table} (${fields.join(',')}) VALUES (${values.map(() => '?').join(',')})`;
            this.saveUpdate(table, sql, values);
            // console.log(this.format(sql, values));
            return this.query(sql, values);
        }
    },

    update: async function(table, fields, whereSql, whereData){
        const fielsdSql = Object.keys(fields).map(e => `${e} = ?`).join(', ');
        fields = Object.values(fields);

        const data = fields;
        let where = '';
        if (whereSql && whereData){
            where = `WHERE ${whereSql}`;
            data.push(...whereData);
        }
        const sql = `UPDATE ${table} SET ${fielsdSql} ${where}`;
        // console.log(this.format(sql, data));
        this.saveUpdate(table, sql, data);
        return this.query(sql, data);
    },

    saveUpdate: function(table, sql, data) {
        if (!configFile.mysql.saveUpdates) {
            return;
        }

        const path = `${__dirname}/mysqlUpdate.json`;
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
        if (!configFile.mysql.replicate.enabled) {
            return;
        }
        
        const replicate = configFile.mysql.replicate;
        console.log(`${replicate.remote}/${replicate.endpoint}`)
        let res = await fetch(`${replicate.remote}/${replicate.endpoint}`);
        const file = await res.json();
        console.log(file)

        while (file.length) {
            const query = file.shift();
    
            res = await fetch(`${replicate.local}/${replicate.endpoint}`, {
                method: 'POST',
                body: new URLSearchParams({
                    query: query.query,
                    connection: JSON.stringify(configFile.mysql.connection),
                }).toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
        }

        return;
    },

    raw: function(str){
        return { toSqlString: () => str };
    },

    formatRaw: function(sql, data){
        const pieces = sql.split('?');

        if (pieces.length > 1){
            let join = pieces.shift();
            
            data.forEach(d => {
                if (d.toSqlString){
                    join += d.toSqlString();
                }
                else{
                    join += '?';
                }
                join += pieces.shift();
            });
    
            sql = join;
            data = data.filter(e => !e.toSqlString);
        }
        
        return [sql, data];
    },

    format: function(sql, data){
        return this.connection.format(sql, data);
    },

    connect: function(){
        if (!this.working){
            this.connection = mysql.createPool(configFile.mysql.connection);
    
            this.connection.getConnection( (err, conn) => {
                if (!this.working){
                    telegram.alert('Mysql connected');
                }

                this.working = true;
                this.connection.releaseConnection(conn);
            });
        }
    },
};


module.exports = db;

