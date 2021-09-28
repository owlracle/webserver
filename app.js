const express = require('express');
const mustacheExpress = require('mustache-express');

const { configFile, Session, verifyRecaptcha } = require('./utils');
const { buildHistory, updateAllCredit } = require('./background');

let port = 4210;

const db = require('./database');
db.connect();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/views');


const api = require('./api')(app);


const args = {
    saveDB: false,
    updateCredit: false,
};

// read node env
if (process.env.PORT){
    port = process.env.PORT;
}
if (process.env.NODE_ENV){
    configFile.production = process.env.NODE_ENV == 'production';
}

// receive args
process.argv.forEach((val, index, array) => {
    if ((val == '-p' || val == '--port') && array[index+1]){
        port = array[index+1];
    }
    if ((val == '-P' || val == '--production')){
        configFile.production = true;
        console.log('Mode set to Production');
    }
    if ((val == '-d' || val == '--development')){
        configFile.production = false;
        console.log('Mode set to Development');
    }
    if ((val == '-h' || val == '--history')){
        args.saveDB = false;
        console.log('History will not be saved');
    }
    if ((val == '-c' || val == '--credit')){
        args.updateCredit = false;
        console.log('Credit will not be updated');
    }
});


app.get('/', indexRoute);
// app.get('/', (req, res) => res.redirect('/bsc'));
// app.get('/bsc', indexRoute);
// app.get('/poly', indexRoute);
// app.get('/avax', indexRoute);
// app.get('/ftm', indexRoute);
// app.get('/eth', indexRoute);

function indexRoute(req, res) {
    res.render(`soon`, {
        usagelimit: api.USAGE_LIMIT,
        requestcost: api.REQUEST_COST,
        recaptchakey: configFile.recaptcha.key,
    });
}


// generate session
app.post('/session', async (req, res) => {
    if (!req.body.grc) {
        res.status(401);
        res.send({
            status: 401,
            error: 'Unauthorized',
            message: 'Your request did not send all the required fields.',
        });
        return;
    }

    const rc = await verifyRecaptcha(req.body.grc);
    if (!rc.success || rc.score < 0.1){
        res.status(401);
        res.send({
            status: 401,
            error: 'Unauthorized',
            message: 'Failed to verify recaptcha.',
            serverMessage: rc
        });
        return;
    }

    const session = (() => {
        if (req.body.currentSession){
            const session = Session.getInstance(req.body.currentSession);
            return session || new Session();
        }
        return new Session();
    })();

    res.send({
        message: 'success',
        sessionid: session.getId(),
        expireAt: session.getExpireAt(),
    });
});


app.use(express.static(__dirname + '/public/'));

app.listen(port, () => {
    console.log(`Listening to port ${port}`);
});


if (configFile.production){
    if (args.saveDB){
        buildHistory();
    }
    if (args.updateCredit){
        updateAllCredit();
    }
}

