const express = require('express');
const mustacheExpress = require('mustache-express');

const { configFile, Session, verifyRecaptcha, networkList } = require('./utils');
const { buildHistory, updateAllCredit, updateTokenPrice } = require('./background');

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
require('./admin')(app);


const args = {
    saveDB: true,
    updateCredit: true,
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
    if ((val == '-u') && array[index+1]){
        const wallet = array[index+1];
        args.updateCredit = false;
        args.updateWallet = wallet.toLowerCase();
        console.log(`Updating credit for wallet ${wallet} only`);
    }
});


app.get('/', indexRoute);
app.get('/bsc', indexRoute);
app.get('/poly', indexRoute);
app.get('/avax', indexRoute);
app.get('/ftm', indexRoute);
app.get('/eth', indexRoute);

function indexRoute(req, res) {
    const network = req.url.split('/')[1];

    res.render(`index`, {
        usagelimit: api.USAGE_LIMIT,
        guestlimit: api.GUEST_LIMIT,
        requestcost: api.REQUEST_COST,
        recaptchakey: configFile.recaptcha.key,
        network: network,
        networkName: (network && (s => s[0].toUpperCase() + s.slice(1))((networkList[network] || networkList.bsc).name)) || 'Multichain',
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


app.get('/admin', (req, res) => {
    res.render(`admin`, {});
});


app.get('/links', (req, res) => {
    res.render(`links`, {});
});


app.use(express.static(__dirname + '/public/'));

app.listen(port, () => {
    console.log(`Listening to port ${port}`);
});


updateTokenPrice().then(() => {
    if (configFile.production){
        if (args.saveDB){
            Object.keys(networkList).forEach(n => buildHistory(n));
        }
        if (args.updateCredit || args.updateWallet){
            updateAllCredit(api, args.updateWallet);
        }
    }
});

