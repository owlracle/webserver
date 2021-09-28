const mysql = require('mysql2');
const fetch = require('node-fetch');

const { configFile } = require('./utils');

const db = {
    working: false,

    query: async function(sql, data) {
        [sql, data] = this.formatRaw(sql, data);
        // console.log(sql, data);
        // console.log(this.connection.format(sql, data));
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
                resolve([rows, error])
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
        // console.log(this.connection.format(sql, data));
        return this.query(sql, data);
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

    connect: function(){
        if (!this.working){
            this.connection = mysql.createPool(configFile.mysql);
    
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


const telegram = {
    url: `https://api.telegram.org/bot{{token}}/sendMessage?chat_id={{chatId}}&text=`,

    alert: async function(message){
        if (!this.token){
            this.token = configFile.telegram.token;
            this.chatId = configFile.telegram.chatId;

            this.url = this.url.replace(`{{token}}`, this.token).replace(`{{chatId}}`, this.chatId);
        }
        if (typeof message !== 'string'){
            message = JSON.stringify(message);
        }

        const resp = configFile.production ? await (await fetch(this.url + encodeURIComponent(message))).json() : true;
        return resp;
    }
}


module.exports = db;

