import { DynamicScript, theme, cookies, wallet, price, api, Tooltip, network as Network, recaptcha } from './utils.min.js';


// remove hidden inputs sent from server
const templateVar = {};
document.querySelectorAll('.template-var').forEach(e => {
    templateVar[e.id] = e.value;
    e.remove();
});


// set recaptcha key
recaptcha.setKey(templateVar.recaptchakey);


// set session id token
const session = {
    get: async function(){
        if (this.isExpired()){
            const body = { grc: await recaptcha.getToken() };
            if (this.id){
                body.currentSession = this.id;
            }

            const data = await (await fetch('/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })).json();
    
            if (!data.error){
                this.id = data.sessionid;
                this.expireAt = data.expireAt;
                return this.id;
            }
            return false;
        }

        return this.id;
    },

    isExpired: function() {
        return this.expireAt ? new Date().getTime() > this.expireAt : true;
    }
};


new DynamicScript('https://kit.fontawesome.com/c1a16f97ec.js');


// set the corresponding network in header
const network = (symbol => {
    let query;
    [symbol, query] = symbol.split('?');

    query = query ? Object.fromEntries(query.split('&').map(e => e.split('='))) : {};

    // no network set, redirect to last network
    if (symbol == ''){
        const queryString = Object.keys(query).length ? '?'+ Object.entries(query).map(([k,v]) => `${k}=${v}`).join('&') : '';
        window.location.href = '/' + (cookies.get('network') || 'bsc') + queryString;
        return;
    }
    
    Network.set(symbol);

    const network = Network.get();

    // place network button in header
    const obj = document.querySelector('#network-btn');
    obj.classList.add(symbol);
    obj.querySelector('.name').innerHTML = network.name;
    obj.querySelector('.icon').src = `img/${symbol}.png`;

    document.querySelector('#title #network-name').innerHTML = `${network.longName || network.name}'s`;

    // network button action
    obj.addEventListener('click', function() {
        const dropdown = document.createElement('div');
        dropdown.id = 'dropdown';
    
        dropdown.innerHTML = Object.entries(Network.getList()).filter(([k,v]) => k != symbol).map(([k,v]) => `<div id="${k}" class="item"><a href="/${k}"><img class="icon" src="img/${k}.png" alt="${v.name} icon"><span class="name">${v.name}</span></a></div>`).join('');
    
        dropdown.style.top = `${this.offsetTop + this.clientHeight}px`;
        dropdown.style.left = `${this.offsetLeft + this.clientWidth - 130}px`;
    
        const fog = document.createElement('div');
        fog.id = 'fog';
        fog.classList.add('invisible');
    
    
        document.body.appendChild(fog);
        fog.appendChild(dropdown);
    
        fog.addEventListener('click', () => fog.remove());
    });

    document.querySelector("#chain").innerHTML = network.name;

    // set the right token to price fetch according to the network
    price.token = network.token;
    price.update();
    setInterval(() => price.update(), 10000); // update every 10s

    document.querySelectorAll('.token-name').forEach(e => e.innerHTML = network.token);
    document.querySelectorAll('.chain-symbol').forEach(e => e.innerHTML = network.symbol);
    document.querySelectorAll('.chain-name').forEach(e => e.innerHTML = network.name);

    // set network block explorer in footer
    const explorer = document.querySelector('footer .resources #explorer');
    explorer.href = network.explorer.href;
    explorer.querySelector('img').src = network.explorer.icon;
    explorer.querySelector('.name').innerHTML = network.explorer.name;

    // set donation wallet modal
    wallet.loadImg(document.querySelector('#donate'), network);
    document.querySelectorAll('.donate-link').forEach(e => wallet.bindModal(e, network));

    if (network.explorer.apiAvailable){
        document.querySelector('#nav-network').remove();
    }

    if (query.ref && query.ref === 'bscgas'){
        const info = document.createElement('div');
        info.innerHTML = `<div id="owlracle-info">
            <div id="message">
                <img src="https://owlracle.info/img/owl.webp" alt="owlracle logo">
                <span>Welcome to Owlracle. Be an early owl and migrate your requests from <a href="https://bscgas.info" target="_blank" rel="noreferrer">Bscgas</a> and get <b>$5</b> worth of API credits for free. <a href="https://t.me/owlracle" target="_blank" aria-label="telegram" rel="noopener">Get in touch</a> today!</span>
            </div>
            <div id="close"><i class="fas fa-times-circle"></i></div>
        </div>`;
        info.querySelector('#close').addEventListener('click', () => info.remove());
        document.body.appendChild(info);
    }

    return network;
})(templateVar.network);


theme.load();
document.querySelector('#theme').addEventListener('click' , () => theme.toggle());

document.querySelector('#toggle-bg').addEventListener('click' , () => {
    cookies.set('particles', cookies.get('particles') == 'false', { expires: { days: 365 } });
    theme.load();
});


// create price chart
const chart = {
    package: import('https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js'),
    ready: false,
    timeframe: 60,
    page: 1,
    candles: 1000,
    lastCandle: (new Date().getTime() / 1000).toFixed(0),
    allRead: false,
    network: network.symbol,

    init: async function() {
        await this.package;

        document.querySelector('#chart').innerHTML = '';
        this.obj = LightweightCharts.createChart(document.querySelector('#chart'), {
            width: Math.min(document.querySelector('#frame').offsetWidth - 20, 600),
            height: 300,
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
            },
        });

        window.addEventListener('resize', () => {
            this.obj.resize(Math.min(document.querySelector('#frame').offsetWidth - 20, 600), 300);
        });
    
        this.series = { gas: {}, token: {}, fee: {} };
        Object.values(this.series).forEach(e => { return {
            colorUp: '#4CA69A',
            colorDown: '#E0544E',
        }});
        
        // set modality buttons behaviour
        document.querySelectorAll(`#chart-container #toggle-container button`).forEach(e => e.addEventListener('click', async () => {
            if (!e.classList.contains('active')){
                document.querySelectorAll(`#chart-container #toggle-container button`).forEach(a => {
                    const series = this.series[a.id];
                    if (a == e){
                        a.classList.add('active');
                        series.visible = true;
                    }
                    else {
                        a.classList.remove('active');
                        series.visible = false;
                    }

                    if (series.series){
                        series.series.applyOptions({ visible: series.visible });
                    }
                });
            }
        }));
    
        const container = document.querySelector('#chart');
        const toolTip = document.createElement('div');
        toolTip.id = 'tooltip-chart';
        container.appendChild(toolTip);
    
        // hover mouse over candles
        this.obj.subscribeCrosshairMove(param => {
            const s = Object.keys(this.series).map(e => this.series[e].series);
            if (param.point === undefined || !param.time || param.point.x < 0 || param.point.x > container.clientWidth || param.point.y < 0 || param.point.y > container.clientHeight) {
                toolTip.style.display = 'none';
            }
            else {
                toolTip.style.display = 'block';
    
                
                const visibleSerie = Object.keys(this.series).filter(e => this.series[e].visible)[0];
                const price = param.seriesPrices.get(this.series[visibleSerie].series);
                // console.log(price)
                toolTip.innerHTML = Object.entries(price).map(([key, value]) => {
                    const name = key.charAt(0).toUpperCase() + key.slice(1);
                    
                    // trunc to max 4 decimal places
                    if (value.toString().split('.').length >= 2 && value.toString().split('.')[1].length > 4){
                        value = value.toString().split('.');
                        value = value[0] + '.' + value[1].slice(0,4);
                    }

                    return `<div class="${key}"><span class="name">${name}</span>: ${value}</div>`;
                }).join('');

                const coordinateY = container.offsetTop + 10;
                const coordinateX = container.offsetLeft + 10;
    
                toolTip.style.left = `${coordinateX}px`;
                toolTip.style.top = `${coordinateY}px`;
            }
        });

        // switch time frames
        document.querySelectorAll('#timeframe-switcher button').forEach(b => b.addEventListener('click', async () => {
            document.querySelectorAll('#timeframe-switcher button').forEach(e => e.classList.remove('active'));
            const text = b.innerHTML;
            b.innerHTML = `<i class="fas fa-spin fa-cog"></i>`;
            const history = await this.getHistory(b.id.split('tf-')[1]);
            b.classList.add('active');
            b.innerHTML = text;
            this.update(history);

            document.querySelectorAll(`#toggle-container button`).forEach(b => {
                const series = this.series[b.id];
                if (series.visible){
                    series.series.applyOptions({
                        visible: series.visible
                    });
                }
            });
        }));

        this.timeScale = this.obj.timeScale();
    
        this.timeScale.subscribeVisibleLogicalRangeChange(async () => {
            const logicalRange = this.timeScale.getVisibleLogicalRange();
            if (logicalRange !== null && logicalRange.from < 0 && this.history.length >= this.candles && !this.scrolling && !this.allRead) {
                this.scrolling = true;
                const oldHistory = this.history;
                const newHistory = await this.getHistory(this.timeframe, this.page + 1);
                this.history = [...oldHistory, ...newHistory];

                this.update(this.history);
                // console.log(this.history);
                this.page++;
                this.scrolling = false;

                if (newHistory.length == 0){
                    this.allRead = true;
                }
            }
        });

        this.ready = true;

        return;
    },

    update: function(data) {
        // console.log(data);
        if (data.length){
            const seriesName = { gas: 'gasPrice', token: 'tokenPrice', fee: 'txFee'};

            Object.entries(this.series).forEach(([key, value]) => {
                const speedData = data.map(e => { return { 
                    // value: e[key].high,
                    open: e[seriesName[key]].open,
                    close: e[seriesName[key]].close,
                    low: e[seriesName[key]].low,
                    high: e[seriesName[key]].high,
                    time: parseInt(new Date(e.timestamp).getTime() / 1000),
                }}).reverse();
        
                if (!value.series){
                    value.series = this.obj.addCandlestickSeries({
                        upColor: value.colorUp,
                        downColor: value.colorDown,
                        borderDownColor: value.colorDown,
                        borderUpColor: value.colorUp,
                        wickDownColor: value.colorDOwn,
                        wickUpColor: value.colorUp,
                      
                        visible: false,
                    });
                }
                value.series.setData(speedData);
            });
        }
    },

    setTheme: function(name) {
        let background = '#232323';
        let text = '#e3dcd0';
        let lines = '#3c3c3c';

        if (name == 'light'){
            background = '#eeeeee';
            text = '#511814';
            lines = '#c9c9c9';
        }

        this.isReady().then(() => {
            this.obj.applyOptions({
                layout: {
                    backgroundColor: background,
                    textColor: text,
                },
                grid: {
                    vertLines: { color: lines },
                    horzLines: { color: lines },
                },
                rightPriceScale: { borderColor: lines },
                timeScale: { borderColor: lines },
            });
        });
    },

    getHistory: async function(timeframe=60, page=1, candles=this.candles) {
        this.timeframe = timeframe;
        const sessionid = await session.get();
        const token = await recaptcha.getToken();
        this.history = await (await fetch(`/${this.network}/history?grc=${token}&sid=${sessionid}&timeframe=${timeframe}&page=${page}&candles=${candles}&to=${this.lastCandle}&tokenprice=true&txfee=true`)).json();
        // console.log(this.history)
        if (this.history.error){
            console.log(this.history);

            if (this.history.error.status == 401){
                return this.getHistory(timeframe, page, candles);
            }
            return [];
        }
        return this.history;
    },

    isReady: async function() {
        return this.ready || new Promise(resolve => setTimeout(() => resolve(this.isReady()), 10));
    }
};
chart.init().then(() => {
    theme.onChange = () => {
        chart.setTheme(cookies.get('theme') || 'dark');

        if (window.__CPEmbed){
            codePens.forEach(e => e.update());
        }
    };
    
    theme.set(cookies.get('theme') || 'dark');
});


// show tooltips for each gas speed card

const tooltipList = [
    'Accepted on 35% of blocks',
    'Accepted on 60% of blocks',
    'Accepted on 90% of blocks',
    'Accepted on every block',
];
document.querySelectorAll('.gas i.fa-question-circle').forEach((e,i) => {
    new Tooltip(e, tooltipList[i]);
});


// update gas prices every 10s

const gasTimer = {
    interval: 10000, // interval between every request
    toInterval: 100, // interval between timer updates
    counter: 100,
    element: document.querySelector('#countdown #filled'),

    init: function(interval, toInterval){
        this.interval = interval;
        this.toInterval = toInterval;
        this.counter = 1;

        this.countDown();
    },

    countDown: function() {
        setTimeout(() => {
            this.counter--;
            this.element.style.width = `${this.counter / (this.interval / this.toInterval) * 100}%`;
        
            if (this.counter <= 0){
                this.counter = this.interval / this.toInterval;
                this.update().then(() => this.countDown());
            }
            else if (!this.stop) {
                this.countDown();
            }
        }, this.toInterval);
    },

    update: async function() {
        const sessionid = await session.get();
        const token = await recaptcha.getToken();
        const data = await (await fetch(`/${network.symbol}/gas?grc=${token}&sid=${sessionid}`)).json();

        if (data.error){
            console.log(data);
            if (data.status == 401){
                this.stop = true;
                const fog = document.createElement('div');
                fog.id = 'fog';
                fog.innerHTML = `<div id="api-window" class="modal"><div id="content">
                    <h2>Session expired</h2>
                    <p>This page must be reloaded to keep showing updated gas prices</p>
                    <div id="button-container">
                        <button id="reload">Reload</button>
                        <button id="cancel">Cancel</button>
                    </div>
                </div></div>`;
                document.body.appendChild(fog);
                fog.addEventListener('click', () => fog.remove());
                fog.querySelector('#api-window').addEventListener('click', e => e.preventDefault());
                fog.querySelector('#cancel').addEventListener('click', () => fog.remove());
                fog.querySelector('#reload').addEventListener('click', () => window.location.reload());
            }
        }
        else{
            // console.log(data)
            this.onUpdate(data);
        }
        return data;    
    }
};
gasTimer.init(30000, 100);

gasTimer.onUpdate = function(data){
    const gas = data.speeds.map(s => s.gasPrice.toFixed(s.gasPrice == parseInt(s.gasPrice) ? 0 : 2));
    const fee = data.speeds.map(s => s.estimatedFee.toFixed(4));

    document.querySelectorAll('.gas .body').forEach((e,i) => {
        if (data.speeds){
            e.querySelector('.gwei').innerHTML = `${gas[i]} GWei`;
            e.querySelector('.usd').innerHTML = `$ ${fee[i]}`;
        }
    });

    const sample = document.querySelector('#sample');
    if (!sample.classList.contains('loaded')){ 
        sample.innerHTML = JSON.toHTML(data);
        
        sample.classList.add('loaded');

        document.querySelector(`#timeframe-switcher #tf-60`).click();
        document.querySelector(`#toggle-container #gas`).click();
    }

    // after a while, change title to gas prices
    setTimeout(() => document.querySelector('title').innerHTML = `${network.token} ${gas.join(',')} GWei`, 5000);
}


// set tooltips
new Tooltip(document.querySelector('#toggle-bg'), 'Toggle background animation', { delay: 1000, createEvent: 'mouseenter' });
new Tooltip(document.querySelector('#theme'), 'Toggle light/dark mode', { delay: 1000, createEvent: 'mouseenter' });


// codepen ID, fill divs with an embed codepen
class CodePen {
    static started = false;

    constructor(element, id) {
        this.id = id;
        this.element = element;

        this.update();
    }

    async init() {
        if (super.started){
            return true;
        }

        const ready = await import('https://cpwebassets.codepen.io/assets/embed/ei.js');
        super.started = true;
        return ready;
    }

    update(){
        this.init().then(() => {
            const codepenEmbed = `<p class="codepen" data-height="265" data-theme-id="{{THEME}}" data-default-tab="js,result" data-user="pswerlang" data-slug-hash="${this.id}" style="height: 265px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 2px solid; margin: 1em 0; padding: 1em;" data-pen-title="BSC gas price sample code"><span>See the Pen <a href="https://codepen.io/pswerlang/pen/${this.id}">BSC gas price sample code</a> by Pablo (<a href="https://codepen.io/pswerlang">@pswerlang</a>) on <a href="https://codepen.io">CodePen</a>.</span></p>`;
            this.element.innerHTML = codepenEmbed.split('{{THEME}}').join(theme.get());
            window.__CPEmbed();
        });
    }
}
const codePens = ['KKvKJRN', 'BadaMVN'].map((v,i) => new CodePen(document.querySelector(`#codepen${i+1}`), v));


// post method for testing purposes
// window.post = async function(url, args) {
//     const response = await fetch(url, {
//         method: args.method || 'POST',
//         body: JSON.stringify(args),
//         headers: { 'Content-Type': 'application/json' }
//     });
//     return response.json();
// }


document.querySelector('#manage-apikey').addEventListener('click', () => api.showModal());


const limits = {
    REQUEST_COST: templateVar.requestcost,
    USAGE_LIMIT: templateVar.usagelimit,
};
document.querySelectorAll('.request-limit').forEach(e => e.innerHTML = limits.USAGE_LIMIT);
document.querySelectorAll('.request-cost').forEach(e => e.innerHTML = limits.REQUEST_COST);


const dynamicSamples = {
    history: {
        getData: async function(){
            return await new Promise(resolve => {
                const wait = () => {
                    if (chart.history){
                        resolve(chart.history);
                        return;
                    }
                    setTimeout(() => wait(), 10);
                }
                wait();
            });
        },

        update: function(data){
            if (data.length){
                const container = document.querySelector('#history-sample-container');
                container.innerHTML = JSON.toHTML(data.slice(0,1));
                container.querySelectorAll('.indent')[1].insertAdjacentHTML('beforeend', ',');
                container.querySelectorAll('.indent')[0].insertAdjacentHTML('beforeend', '<div class="indent">...</div>');
            }
        }
    },

    keys: {
        placeholder: {
            "apiKey": "00000000000000000000000000000000",
            "creation": "0000-00-00T00:00:00.000Z",
            "wallet": "0x0000000000000000000000000000000000000000",
            "credit": 0,
            "origin": "domain.com",
            "note": "note to myself",
            "usage": {
                "apiKeyHour": 0,
                "apiKeyTotal": 0,
            }
        },

        getData: async function(key){
            if (!key){
                return this.placeholder;
            }
            const data = await api.getKey(key);
            if (data.apiKey){
                this.realData = true;
                return data;
            }
            return this.placeholder;
        },

        update: function(data) {
            const container = document.querySelector('#key-get-info-container');
            container.innerHTML = JSON.toHTML(data);
        }
    },

    credit: {
        placeholder: {
            "message": "success",
            "results": [{
                "network": "xxx",
                "tx": "0x0000000000000000000000000000000000000000000000000000000000000000",
                "timestamp": "2000-00-00T00:00:00.000Z",
                "value": "0",
                "price": "0",
                "fromWallet": "0x0000000000000000000000000000000000000000"
            }]
        },

        getData: async function(key){
            if (!key){
                return this.placeholder;
            }
            const data = await api.getCredit(key);
            if (data.message == 'success' && data.results.length > 0){
                this.realData = true;
                return data;
            }
            return this.placeholder;
        },

        update: function(data) {
            const container = document.querySelector('#key-credit-info-container');
            data.results = data.results.slice(0,1);
            container.innerHTML = JSON.toHTML(data);
            container.querySelectorAll('.indent')[2].insertAdjacentHTML('beforeend', ',');
            container.querySelectorAll('.indent')[0].insertAdjacentHTML('beforeend', '<div class="indent">...</div>');
        },
    },

    logs: {
        placeholder: [{
            "ip": "255.255.255.255",
            "origin": "domain.com",
            "timestamp": "0000-00-00T00:00:00.000Z",
            "endpoint": "xxx",
            "network": "xxx"
        }],

        getData: async function(key){
            if (!key){
                return this.placeholder;
            }
            const data = await api.getLogs(key);
            if (!data.error && data.length > 0){
                this.realData = true;
                return data;
            }
            return this.placeholder;
        },

        update: function(data) {
            const container = document.querySelector('#key-logs-info-container');
            container.innerHTML = JSON.toHTML(data.slice(0,1));
            container.querySelectorAll('.indent')[1].insertAdjacentHTML('beforeend', ',');
            container.querySelectorAll('.indent')[0].insertAdjacentHTML('beforeend', '<div class="indent">...</div>');
        },
    },

    update: async function(key){
        
        if (!key){
            this.history.getData().then(data => this.history.update(data));
        }
        [this.keys, this.credit, this.logs].map(item => { return {
            obj: item,
            promise: item.getData(key)
        }}).forEach(item => item.promise.then(data => item.obj.update(data)));
    },
};
dynamicSamples.update();


class UrlBox {
    constructor(element, {
        method = 'GET',
        href = '#',
        variables = {},
        network: isNetwork = false,
    }){
        this.content = href;
        this.href = href;
        this.mask = href;
        this.network = isNetwork ? `/${network.symbol}` : '';

        const domain = 'https://owlracle.info';
        const placeholder = 'YOUR_API_KEY';

        // replace apikey keyword with input
        this.href = this.href.replace(`{{apikey}}`, placeholder);
        this.content = this.content.replace(`{{apikey}}`, `</a><input class="fill-apikey" type="text" placeholder="${placeholder}"><a href="${this.href}" target="_blank">`);

        // fill variables
        Object.entries(variables).forEach(([k, v]) => {
            this.content = this.content.split(`{{${k}}}`).join(v.toString());
            this.href = this.href.split(`{{${k}}}`).join(v.toString());
            this.mask = this.mask.split(`{{${k}}}`).join(v.toString());
        });

        this.content = `
            <span class="button-get"><i class="far fa-question-circle"></i>${method}</span>
            <a href="${this.href}" target="_blank">${domain}${this.network}${this.content}</a>
            <span class="button-copy"><i class="far fa-copy"></i></span>
        `;

        element.innerHTML = this.content;

        new Tooltip(element.querySelector('.button-get'), 'GET request URL using all available arguments with their default values');

        // click on copy
        element.querySelector('.button-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(element.querySelector('a').href);
            const box = element.querySelector('.button-copy').parentNode;
            box.classList.add('clicked');
            setTimeout(() => box.classList.remove('clicked'), 200);
        });

        // when type an apikey, all fields update
        element.querySelectorAll('.fill-apikey').forEach(input => {
            input.addEventListener('keyup', () => {
                document.querySelectorAll('.fill-apikey').forEach(x => {
                    const href = Array.from(x.parentNode.querySelectorAll('a, input')).map(e => e.textContent || e.value).join('');
                    x.parentNode.querySelectorAll('a').forEach(e => e.href = href);
                    x.value = input.value;
                    x.style.width = `${input.value.length * 8.75}px`;
                });
            });

            input.addEventListener('input', () => {
                if (input.value.match(api.regex.apiKey)){
                    dynamicSamples.update(input.value);
                }
            });
        });

    }
}

// define sample requests url box
new UrlBox(document.querySelector('#url-gas.url'), {
    network: true,
    href: `/gas?apikey={{apikey}}&nmin=0.3&accept=35,60,90,100&blocks=200&version=2`,
});
new UrlBox(document.querySelector('#url-history.url'), {
    network: true,
    href: `/history?apikey={{apikey}}&from=0&to={{now}}&page=1&candles=1000&timeframe=30&tokenprice=false&txfee=false`,
    variables: { now: (new Date().getTime() / 1000).toFixed(0) }
});
new UrlBox(document.querySelector('#url-keys.url'), { href: `/keys/{{apikey}}` });
new UrlBox(document.querySelector('#url-credit.url'), { href: `/credit/{{apikey}}` });
new UrlBox(document.querySelector('#url-logs.url'), {
    href: `/logs/{{apikey}}?fromtime={{past1h}}&totime={{now}}`,
    variables: {
        past1h: (new Date().getTime() / 1000 - 3600).toFixed(0),
        now: (new Date().getTime() / 1000).toFixed(0)
    }
});


// build faq
const faq = [
    [`What is Owlracle?`,
    `Owlracle is an open-source gas price oracle running predictions for multiple blockchain networks. We provide a website and an API for retrieving Owlracle's information, giving dapp developers easy access to gas information.`],
    [`How do you make the gas price predictions?`,
    `This tool attempts to predict the gas price to be paid on multiple chains by averaging recent past transactions. For each block, we take the mined transaction with the lower gas price. Every speed is measured by calculating the minimum gas price paid to be accepted on a given percentage of past blocks. Take into consideration that the numbers shown are just estimations.`],
    [`Your website looks so much like <a href="https://bscgas.info" target="_blank" rel="noreferrer">Bscgas</a>. Is it a coincidence?`,
    `Not at all. We are the same team as bscgas. But as soon as we noticed the demand to expand to other networks, we created owlracle to be a gas price oracle hub on every major chain. We also developed our own oracle software, so we thought we should rebrand ourselves.`],
    [`I came from <a href="https://bscgas.info" target="_blank" rel="noreferrer">Bscgas</a> and want to use the old style /gas endpoint. How can I?`,
    `Easy! Just set query parameter version=1. The output format will be just like Good Ol' Bscgas.`],
    [`How do you predict the gas price fee?`,
    `We scan the last N (default 200) blocks and check the minimum gas price accepted on a transaction for each block. Then we calculate how much gas you should pay to be accepted on X% (varying by speed) of these blocks.`],
    [`My app have thousands of user requesting bscgas service. The API limit seems too low.`,
    `You should never call our API from the frond-end. Schedule your server to retrieve information at time intervals of your choice, then when your users request it, just send the cached data to them.`],
    [`Shouldn't I be worried if users peek into my app's source-code and discover my API key?`,
    `Do not EVER expose your API key on the front-end. If you do so, users will be able to read your source-code then make calls using your API (thus expending all your credits). Retrieve our data from your server back-end, then provide the cached data to your users when they request it.`],
    [`My API key have been exposed. What should I do?`,
    `You can reset your API key hash and generate a new one <a id="link-reset-key">clicking here</a>.`],
    [`I want to make a recharge. Where can I find my API wallet?`,
    `Your API wallet can be found in the <a onclick="document.querySelector('#manage-apikey').click()">API management window</a>. To add credits to your account, just make a <span class="token-name"></span> transfer of any amount to your API wallet. Use the management window to update your balance and keep track of your recharge history.`],
];
document.querySelector('#faq').innerHTML = `<ul>${faq.map(e => `<li><ul><li class="question"><i class="fas fa-angle-right"></i>${e[0]}</li><li class="answer">${e[1]}</li></ul></li>`).join('')}</ul>`;
document.querySelectorAll('#faq .question').forEach(e => e.addEventListener('click', () => e.parentNode.classList.toggle('open')));

document.querySelector('#link-reset-key').addEventListener('click', () => api.showModal('edit'));
document.querySelectorAll('#faq .token-name').forEach(e => e.innerHTML = network.token);

// smooth scrolling when clicking link
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    });
});


// set footer link to api key management window
// document.querySelector('#footer-keys').addEventListener('click', () => api.showModal());


// pretty print json inside html
JSON.toHTML = (json, roll) => {
    if (!roll) {
        let res = `<div class="json indent">${JSON.toHTML(json, true)}</div>`;
        return Array.isArray(json) ? `[${res}]` : `{${res}}`;
    }
    if (Array.isArray(json)) {
        return json.map((e, i) => {
            const comma = i < json.length - 1 ? ',' : '';
            let value = JSON.toHTML(e, true);
            if (typeof e === 'object') {
                value = `{${value}}`;
            }
            return `<div class="json indent">${value}${comma}</div>`;
        }).join('');
    }
    else if (json == null) {
        return `<span class="json">null</span>`;
    }
    else if (typeof json === 'object') {
        return Object.entries(json).map(([key, value]) => {
            let valueStr = JSON.toHTML(value, true);
            if (Array.isArray(value)) {
                valueStr = `[${valueStr}]`;
            }
            else if (value == null) {
                valueStr = `null`;
            }
            else if (typeof value === 'object') {
                valueStr = `{${valueStr}}`;
            }

            const comma = Object.keys(json).slice(-1)[0] != key ? ',' : '';
            return `<div class="json indent"><span class="json key">"${key}"</span>: ${valueStr}${comma}</div>`;
        }).join('');
    }
    else {
        const type = typeof json === 'string' ? 'string' : 'number';
        if (type == 'string') {
            json = `"${json}"`;
        }
        return `<span class="json ${type}">${json}</span>`;
    }
};