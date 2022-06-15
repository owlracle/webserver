import { DynamicScript, theme, cookies, wallet, price, api, Tooltip, network as Network, recaptcha, fadeIn, infoMessageModal, Modal, startHeaderApiSearch, Toast } from './utils.min.js';

startHeaderApiSearch();

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
        window.location.href = '/' + (cookies.get('network') || 'eth') + queryString;
        return;
    }
    
    Network.set(symbol);

    const network = Network.get();

    // place network button in header
    const obj = document.querySelector('#network-btn');
    obj.classList.add(symbol);
    obj.querySelector('.name').innerHTML = network.name;
    obj.querySelector('.icon').src = `img/${symbol}.png`;

    let netName = network.longName || network.name;
    netName = netName.slice(-1) == 's' ? `${netName}'` : `${netName}'s`;
    document.querySelector('#title #network-name').innerHTML = netName;

    // network button action
    obj.addEventListener('click', function() {
        const dropdown = document.createElement('div');
        dropdown.id = 'dropdown';
    
        dropdown.innerHTML = Object.entries(Network.getList()).filter(([k,v]) => k != symbol && !v.disabled).map(([k,v]) => `<div id="${k}" class="item"><a href="/${k}"><img class="icon" src="img/${k}.png" alt="${v.name} icon"><span class="name">${v.name}</span></a></div>`).join('');
    
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
    setInterval(() => price.update(), 1000 * 60); // update every 1m

    document.querySelectorAll('.token-name').forEach(e => e.innerHTML = network.token);
    document.querySelectorAll('.chain-symbol').forEach(e => e.innerHTML = network.symbol);
    document.querySelectorAll('.chain-name').forEach(e => e.innerHTML = network.name);

    // set network block explorer in footer
    const explorer = document.querySelector('footer .resources #explorer');
    explorer.href = network.explorer.href;
    explorer.querySelector('img').src = network.explorer.icon;
    explorer.querySelector('.name').innerHTML = network.explorer.name;

    // set donation wallet modal
    const donateNetwork = network.nonevm ? Network.get('bsc') : network;
    wallet.loadImg(document.querySelector('#donate'), donateNetwork);
    document.querySelectorAll('.donate-link').forEach(e => wallet.bindModal(e, donateNetwork));
    document.querySelector('#donate .token').innerHTML = donateNetwork.token;
    document.querySelector('#donate .chain').innerHTML = donateNetwork.name;

    if (network.explorer.apiAvailable){
        document.querySelector('#nav-network').remove();
    }

    const cookieName = 'hide-info-3';

    // If got here through a ref link
    if (query.ref && query.ref === '') {
        // future code here
    }
    // show an intro message. show again each week
    else if (!cookies.get(cookieName)){
        const message = infoMessageModal.show(`Owlracle extension can now automatically recommend gas prices into your Metamask tx confirmation window (free for a limited time). <a>Check it out!</a>`);
        infoMessageModal.onClose = () => cookies.set(cookieName, true, { expires: { days: 7 }, json: true });

        message.querySelector('a').addEventListener('click', () => {
            window.open('/extension');
        });
        // new Modal(`
        //     <h1>Metamask integration</h1>
        //     <p>We are very excited to announce that from now on, every API recharge will be made using <a href="https://metamask.io/" target="_blank" rel="noopener">Metamask</a> extension. We believe this change will make easier for users to make recharges, and also make our app more in line with other Web3 services.</p>
        //     <p>When creating API keys, or accessing your keys' information, the <b>wallet</b> field will no longer be shown on those windows.</p>
        //     <p>Whenever you want to make an API recharge, you can access the new key tab <a href="?action=recharge">Recharge key</a>. In this tab, Owlracle will guide you through connecting your Metamask wallet with the website, and making the recharge transaction.</p>
        //     <p>Once the transaction is confirmed, your API credit will be automatically updated. Should you find any issue while recharging, don't hesitate to contact us through any of <a href="/links">our channels</a>.</p>
        //     <p>The old method will still be usable for 30 days. After 22-04-17, any tokens sent to the old API wallets will not increase your API credits. However, you can still <a href="https://t.me/owlracle" target="_blank" rel="noopener">contact us</a> to ask us to send your tokens back though.</p>
        //     <p>As always, we are eager to hear your thoughts.</p>
        // `, { large: true });
    }


    // query action based on tab name
    const tabAliases = {
        create: [ 'newkey' ],
        info: [ 'keys' ],
        recharge: [],
        alerts: [],
        history: [],
        logs: [],
    }
    if ( query.action && ( Object.keys(tabAliases).includes(query.action) || Object.values(tabAliases).flat().includes(query.action) ) ) {
        (async () => {
            if (query.apikey) {
                await api.login(query.apikey);                
            }
            let chosenTab;
            if (Object.keys(tabAliases).includes(query.action)) {
                chosenTab = query.action;
            }
            else {
                // get key from a matching value
                chosenTab = Object.entries(tabAliases).map(([k,v]) => v.includes(query.action) ? k : false).find(e => e);
            }
            api.showProfile(chosenTab);
        })();
    }

    return network;
})(templateVar.network);


theme.load();
document.querySelector('#theme').addEventListener('click' , () => theme.toggle());

if (window.outerWidth < 600){
    document.querySelector('#toggle-bg').remove();
}
else {
    document.querySelector('#toggle-bg').addEventListener('click' , () => {
        cookies.set('particles', cookies.get('particles') == 'false', { expires: { days: 365 } });
        theme.load();
    });
    new Tooltip(document.querySelector('#toggle-bg'), 'Toggle background animation', { delay: 1000, createEvent: 'mouseenter' });
}


// create price chart
const chart = {
    package: import('https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js'),
    ready: false,
    timeframe: 60,
    page: 1,
    candles: 200,
    lastCandle: (new Date().getTime() / 1000).toFixed(0),
    allRead: false,
    network: network.symbol,
    mode: 'gas',
    config: {
        area: {
            style: 'area',
            color: '#2962ff',
        },
        candlestick: {
            style: 'candlestick',
            colorUp: '#4CA69A',
            colorDown: '#E0544E',
        },
    },
    preferences: { gas: 'area', token: 'candlestick', fee: 'area' },

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
    
        // copy object
        this.series = {
            gas: { config: Object.assign({}, this.config[this.preferences.gas]) },
            token: { config: Object.assign({}, this.config[this.preferences.token]) },
            fee: { config: Object.assign({}, this.config[this.preferences.fee]) },
        };
        
        // set modality buttons behaviour
        document.querySelectorAll(`#chart-container #toggle-container button`).forEach(e => e.addEventListener('click', async () => {
            if (e.classList.contains('active')){
                return;
            }

            document.querySelectorAll(`#chart-container #toggle-container button`).forEach(a => {
                const series = this.series[a.id];
                if (a == e) {
                    a.classList.add('active');
                    series.visible = true;
                    this.mode = a.id;

                    // set candlestick or area button
                    document.querySelectorAll('#chart-container #style-switcher button').forEach(e => e.classList.remove('active'));
                    document.querySelector(`#chart-container #style-${series.config.style}`).classList.add('active');

                }
                else {
                    a.classList.remove('active');
                    series.visible = false;
                }

                if (series.series) {
                    series.series.applyOptions({ visible: series.visible });
                }
            });
        }));

        const container = document.querySelector('#chart');
        const toolTip = document.createElement('div');
        toolTip.id = 'tooltip-chart';
        container.appendChild(toolTip);
    
        // hover mouse over candles
        this.obj.subscribeCrosshairMove(param => {
            // const s = Object.keys(this.series).map(e => this.series[e].series);
            if (param.point === undefined || !param.time || param.point.x < 0 || param.point.x > container.clientWidth || param.point.y < 0 || param.point.y > container.clientHeight) {
                toolTip.style.display = 'none';
            }
            else {
                toolTip.style.display = 'block';
                
                const visibleSerie = Object.keys(this.series).filter(e => this.series[e].visible)[0];
                const price = param.seriesPrices.get(this.series[visibleSerie].series);
                // console.log(price)
                if (price && typeof price !== 'number'){
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
                else {
                    toolTip.style.display = 'none';
                }
            }
        });

        // switch time frames
        const switcherButtons = document.querySelectorAll('#timeframe-switcher button');
        switcherButtons.forEach(b => b.addEventListener('click', async () => {
            if (this.queryHistory){
                return;
            }

            switcherButtons.forEach(e => e.classList.remove('active'));
            const text = b.innerHTML;
            b.innerHTML = `<i class="fas fa-spin fa-cog"></i>`;
            this.queryHistory = true;
            const history = await this.getHistory(b.id.split('tf-')[1]);
            // console.log(history)
            b.classList.add('active');
            b.innerHTML = text;
            this.update(history);
            this.setCookie();
            this.queryHistory = false;

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


        // set candle/area style buttons behaviour
        document.querySelectorAll('#chart-container #style-switcher button').forEach(e => e.addEventListener('click', async () => {
            if (e.classList.contains('active')){
                return;
            }

            e.parentNode.querySelectorAll('button').forEach(e => e.classList.toggle('active'));
            const text = e.innerHTML;
            e.innerHTML = `<i class="fas fa-spin fa-cog"></i>`;

            const serie = this.series[this.mode];
            serie.config = Object.assign({}, this.config[e.id.split('style-')[1]]);
            const history = await this.getHistory(this.timeframe);

            this.obj.removeSeries(serie.series);
            serie.series = null;

            this.update(history);

            serie.series.applyOptions({ visible: serie.visible });

            e.innerHTML = text;

            this.setCookie();
        }));


        this.ready = true;

        return;
    },

    setCookie: function() {
        const cookieChart = Object.fromEntries(Object.entries(this.series).map(([k,v]) => [k, v.config.style]));
        cookieChart.timeframe = this.timeframe;
        cookies.set('chart', JSON.stringify(cookieChart), { expires: { days: 365 } });
    },

    update: function(data) {
        // console.log(data);
        if (data.length){
            const seriesName = { gas: 'gasPrice', token: 'tokenPrice', fee: 'txFee'};

            Object.entries(this.series).forEach(([key, value]) => {
                const speedData = data.map(e => { 
                    if (value.config.style == 'candlestick'){
                        return { 
                            // value: e[key].high,
                            open: e[seriesName[key]].open,
                            close: e[seriesName[key]].close,
                            low: e[seriesName[key]].low,
                            high: e[seriesName[key]].high,
                            time: parseInt(new Date(e.timestamp).getTime() / 1000),
                        }
                    }
                    return { 
                        value: (e[seriesName[key]].close + e[seriesName[key]].open) / 2,
                        time: parseInt(new Date(e.timestamp).getTime() / 1000),
                    }
                }).reverse();
        
                if (!value.series){
                    if (value.config.style == 'candlestick'){
                        value.series = this.obj.addCandlestickSeries({
                            upColor: value.config.colorUp,
                            downColor: value.config.colorDown,
                            borderDownColor: value.config.colorDown,
                            borderUpColor: value.config.colorUp,
                            wickDownColor: value.config.colorDOwn,
                            wickUpColor: value.config.colorUp,
                            visible: false,
                        }); 
                    }
                    else {
                        value.series = this.obj.addAreaSeries({
                            lineColor: value.config.color,
                            topColor: `${value.config.color}80`,
                            bottomColor: `${value.config.color}10`,
                            lineWidth: 2,
                            visible: false,
                        });
                    }
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

// load chart preferences cookie
if (cookies.get('chart')){
    let chartCookie = null;
    try {
        chartCookie = JSON.parse(cookies.get('chart'));
    }
    catch (error){
        console.log(error);
        cookies.delete('chart');
    }

    // test each individually to unsure loading only valid values
    if (chartCookie.gas){
        chart.preferences.gas = chartCookie.gas;
    }
    if (chartCookie.token){
        chart.preferences.token = chartCookie.token;
    }
    if (chartCookie.fee){
        chart.preferences.fee = chartCookie.fee;
    }
    if (chartCookie.timeframe){
        chart.timeframe = chartCookie.timeframe;
    }
}

chart.init().then(() => {
    theme.onChange = () => {
        chart.setTheme(cookies.get('theme') || 'dark');
    };
    
    theme.set(cookies.get('theme') || 'dark');
});


// update gas prices every 10s

const gasTimer = {
    interval: 10000, // interval between every request
    toInterval: 100, // interval between timer updates
    counter: 100,
    element: document.querySelector('#countdown #filled'),
    cards : [ // preferences for cards
        { name: '🛴Slow', tooltip: 'Accepted on 35% of blocks', accept: 35 },
        { name: '🚗Standard', tooltip: 'Accepted on 60% of blocks', accept: 60 },
        { name: '✈️Fast', tooltip: 'Accepted on 90% of blocks', accept: 90 },
        { name: '🚀Instant', tooltip: 'Accepted on every block', accept: 100 },
    ],

    init: function(interval, toInterval){
        this.interval = interval;
        this.toInterval = toInterval;
        this.counter = 1;

        this.loadCookie();
        this.buildCards();
        this.countDown();
    },

    buildCards: function() {
        const container = document.querySelector('#gas-container');
        container.innerHTML = '';

        this.cards.forEach(card => {
            const dom = `<div class="gas">
                <div class="title">
                    <div class="left">${card.name} ${card.tooltip ? '<i class="far fa-question-circle"></i>' : ''}</div>
                    <div class="right" title="Change this card"><i class="fas fa-edit"></i></div>
                </div>
                <div class="body">
                    <div class="gwei"><i class="fas fa-spin fa-cog"></i></div>
                    <div class="usd"></div>
                </div>
            </div>`;
            container.insertAdjacentHTML('beforeend', dom);
        });

        container.querySelectorAll('.gas i.fa-question-circle').forEach((e,i) => new Tooltip(e, this.cards[i].tooltip));
        container.querySelectorAll('.gas i.fa-edit').forEach((e,i) => {
            new Tooltip(e.parentNode, null, { createEvent: 'mouseenter', delay: 1500 });

            e.parentNode.addEventListener('click', () => {
                const fog = document.createElement('div');
                fog.id = 'fog';
                fog.innerHTML = `<div id='edit-cards' class="modal">
                    <h2>Edit gas cards</h2>
                    <h3>Replace the following query parameters</h3>
                    <div class="input-container"><span class="title">Blocks</span><input id="blocks" class="input-text" value="${this.blocks || ''}"></div>
                    <div class="input-container"><span class="title">Percentile</span><input id="percentile" class="input-text" value="${this.percentile || ''}"></div>
                    <div class="input-container"><span class="title">Accept</span><input id="accept" class="input-text" value="${this.cards.map(e => e.accept).join(',')}"></div>
                    <div class="input-container"><span class="title">Card names</span><input id="names" class="input-text" value="${this.cards.map(e => e.name).join(',')}"></div>
                    <div id="button-container">
                        <button id="reset">RESET</button>
                        <button id="save">SAVE</button>
                    </div>
                </div>`;
        
                fog.addEventListener('click', () => fog.remove());
                fog.querySelector('div').addEventListener('click', e => e.stopPropagation());
        
                // restore original cards
                fog.querySelector("#reset").addEventListener('click', () => {
                    cookies.delete('gas-cards');
                    window.location.reload();
                });

                // save card config
                fog.querySelector("#save").addEventListener('click', () => {
                    const blocks = fog.querySelector('#blocks').value;
                    const percentile = fog.querySelector('#percentile').value;
                    const accept = fog.querySelector('#accept').value.split(',');
                    const names = fog.querySelector('#names').value.split(',');

                    if (parseInt(blocks)){
                        this.blocks = parseInt(blocks);
                    }

                    if (parseFloat(percentile) && parseFloat(percentile) >= 0.01){
                        this.percentile = parseFloat(percentile);
                    }

                    if (accept.length){
                        this.cards = accept.map((e,i) => { return { name: names[i], accept: parseInt(e) }});
                    }

                    this.setCookie();
                    window.location.reload();
                })

                document.body.appendChild(fog);
                fadeIn(fog, 500);        
            });
        });
    },

    loadCookie: function() {
        if (cookies.get('gas-cards')){
            let cardCookie = null;
            try {
                cardCookie = JSON.parse(cookies.get('gas-cards'));
            }
            catch (error){
                console.log(error);
                cookies.delete('gas-cards');
            }
        
            // test each individually to unsure loading only valid values
            if (cardCookie.blocks){
                const blocks = Math.min(Math.max(1, cardCookie.blocks), 1000);
                if (blocks) {
                    this.blocks = blocks;
                }

            }
            if (cardCookie.percentile){
                const percentile = parseFloat(cardCookie.percentile);
                if (percentile && percentile >= 0.01) {
                    this.percentile = percentile;
                }
    
            }
            if (cardCookie.cards){
                this.cards = cardCookie.cards.filter(e => parseInt(e.accept) && parseInt(e.accept) >= 0 && parseInt(e.accept) <= 100);
            }
        }
    },

    setCookie: function() {
        const data = { cards: this.cards };

        if (this.blocks){
            data.blocks = this.blocks;
        }
        if (this.percentile){
            data.percentile = this.percentile;
        }

        cookies.set('gas-cards', JSON.stringify(data), { expires: { days: 365 } });
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
        let query = {
            grc: await recaptcha.getToken(),
            sid: await session.get(),
            accept: this.cards.map(e => e.accept).join(','),
        };

        if (this.blocks){
            query.blocks = this.blocks;
        }
        if (this.percentile){
            query.percentile = this.percentile;
        }

        query = new URLSearchParams(query).toString();
        const data = await (await fetch(`/${network.symbol}/gas?${query}`)).json();

        if (data.error){
            console.log(data);
            if (data.status == 401){
                this.stop = true;
                const fog = document.createElement('div');
                fog.id = 'fog';
                fog.innerHTML = `<div id="api-window" class="modal"><div id="content">
                    <h2>Session expired</h2>
                    <p>This page must be reloaded to keep showing updated gas fees</p>
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
    },

    addBaseFeeInfo: function() {
        if (!document.querySelector('#gas-container .gas .body .eip')){
            document.querySelectorAll('#gas-container .gas .body').forEach(e => e.insertAdjacentHTML('beforeend', '<div class="eip"></div>'));

            const faqList = faq.getList();
            faqList.unshift(
                ['What is the Base fee value I see in the gas cards?', 'Base fee is a value determined by the network itself. It is the lower value you should pay to have your transaction mined. It changes form time to time, and Owlracle outputs the average value of the last blocks. This value is burned. Max fee = Base fee + Priority fee. Check <a href="https://notes.ethereum.org/@vbuterin/eip-1559-faq" target="_blank" rel="noopener nofollow">EIP-1559</a> for more info.'],
                ['What is the priority fee?', 'These are the values you should pay to incentivize miners to process your transactions. The higher the value, faster they will be mined. Higher values means more costly transactions though. That is where Owlracle can help you giving accurate estimates so you can pay no more than what is needed. Max fee = Base fee + Priority fee. Check <a href="https://notes.ethereum.org/@vbuterin/eip-1559-faq" target="_blank" rel="noopener nofollow">EIP-1559</a> for more info.'],
                ['What is the "Max fee" value I see on my metamask wallet?', 'Max fee = Base fee + Priority fee. Check <a href="https://notes.ethereum.org/@vbuterin/eip-1559-faq" target="_blank" rel="noopener nofollow">EIP-1559</a> for more info.']
            )
            // console.log(faqList);
            faq.setList(faqList);
        }
    }
};
gasTimer.init(30000, 100);

gasTimer.onUpdate = function(data){
    window.gasPrice = data;
    let gas = data.speeds.map(s => network.nonevm ? s.fee : s.gasPrice);
    let baseFee = 0;
    
    if (data.baseFee){
        // gas = gas.map(s => s - data.baseFee);
        this.addBaseFeeInfo();

        baseFee = data.baseFee.toFixed(data.baseFee == parseInt(data.baseFee) ? 0 : 2);

        document.querySelectorAll('#gas-container .gas .eip').forEach((e,i) => {
            e.innerHTML = `
                <span class="value"><span class="text">Base:</span> ${baseFee} ${ network.nonevm ? network.unit : 'GWei' }</span>
                <span class="value"><span class="text">Tip:</span> ${ Math.max(0, gas[i] - baseFee).toFixed(2) } ${ network.nonevm ? network.unit : 'GWei' }</span>
            `;
        });
    }
    gas = gas.map(s => s.toFixed(s == parseInt(s) ? 0 : 2));

    const fee = data.speeds.map(s => network.nonevm ? s.feeUSD.toFixed(4) : s.estimatedFee.toFixed(4));

    document.querySelectorAll('#gas-container .gas .body').forEach((e,i) => {
        if (data.speeds){
            e.querySelector('.gwei').innerHTML = `${gas[i]} ${ network.nonevm ? network.unit : 'GWei' }`;
            e.querySelector('.usd').innerHTML = `$ ${fee[i]}`;
        }
    });

    // update rpc info
    (async () => {
        const data = await (await fetch(`/rpc/${network.symbol}`)).json();
        const now = parseInt(new Date().getTime() / 1000);
        setColorGradient(document.querySelector('#time-sign'), now - data.lastTime);
    })();


    if (!this.started){ 
        document.querySelector(`#timeframe-switcher #tf-${chart.timeframe}`).click();
        document.querySelector(`#toggle-container #gas`).click();
        this.started = true;
    }

    // after a while, change title to gas prices
    setTimeout(() => document.title = `${gas.map(e => parseInt(e)).join(', ')} ${ network.nonevm ? network.unit : 'GWei' } 🦉 ${network.token} Gas tracker 🦉 Owlracle`, 5000);
};


function setColorGradient(elem, time){
    const maxTime = 300;
    const rate = Math.min(time, maxTime) / maxTime;

    const color = {b: '00', toString: color => '00'.slice(color.toString(16).length) + color.toString(16)};
    color.r = color.toString(Math.round(rate * 200));
    color.g = color.toString(Math.round((1 - rate) * 200));

    elem.style['background-color'] = `#${color.r}${color.g}${color.b}`;
    new Tooltip(elem, `RPC last update was ${time}s ago`, { createEvent: 'mouseenter' });
}


// set tooltips
new Tooltip(document.querySelector('#theme'), 'Toggle light/dark mode', { delay: 1000, createEvent: 'mouseenter' });


document.querySelector('#manage-apikey').addEventListener('click', () => api.showProfile('create'));


const limits = {
    REQUEST_COST: templateVar.requestcost,
    USAGE_LIMIT: templateVar.usagelimit,
    GUEST_LIMIT: templateVar.guestlimit,
};
document.querySelectorAll('.request-limit').forEach(e => e.innerHTML = limits.USAGE_LIMIT);
document.querySelectorAll('.guest-limit').forEach(e => e.innerHTML = limits.GUEST_LIMIT);
document.querySelectorAll('.request-cost').forEach(e => e.innerHTML = limits.REQUEST_COST);


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
        this.href = this.network + this.href;
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

        new Tooltip(element.querySelector('.button-get'), 'GET request');

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
        });

    }
}

// define sample requests url box
new UrlBox(document.querySelector('#url-gas.url'), { network: true, href: `/gas`, });
new UrlBox(document.querySelector('#url-history.url'), { network: true, href: `/history`, });
new UrlBox(document.querySelector('#url-keys.url'), { href: `/keys/YOUR_API_KEY` });
new UrlBox(document.querySelector('#url-credit.url'), { href: `/credit/YOUR_API_KEY` });
new UrlBox(document.querySelector('#url-logs.url'), { href: `/logs/YOUR_API_KEY`, });


// build faq
const faq = {
    list: [
        [`What is Owlracle?`,
        `Owlracle is an open-source gas oracle running predictions for multiple blockchain networks. We provide a website and an API for retrieving Owlracle's information, giving dapp developers easy access to gas information. Check our <a href="https://t.co/dNa1H1g9iA" target="_blank" rel="noopener">Medium article</a> explaining that in details.`],
        [`How do you make the gas predictions?`,
        `This tool attempts to predict the gas to be paid on multiple chains by averaging recent past transactions. For each block, we take the mined transaction with the lower gas. Every speed is measured by calculating the minimum gas paid to be accepted on a given percentage of past blocks. Take into consideration that the numbers shown are just estimations. Check our <a href="https://t.co/dNa1H1g9iA" target="_blank" rel="noopener">Medium article</a> explaining that in details.`],
        [`How do you predict the gas fee?`,
        `We scan the last N (default 200) blocks and check the minimum gas accepted on a transaction for each block. Then we calculate how much gas you should pay to be accepted on X% (varying by speed) of these blocks.`],
        [`I like your service. When will you come to my favorite network?`,
        `We are constantly evaluating the benefits of adding new networks to our oracle. In general, we try to priorize networks with a good amount of monthly transactions and/or trending ones. If you feel we are missing a promising network, feel free to <a href="https://discord.gg/RhWmhSnPnM" target="_blank" rel="noopener">contact us</a> and share your opinion.`],
        [`I like your website, but I wish there was a more convenient tool. Like a browser extension.`,
        `Weel, there is! You can go to Chrome Web Store and download our <a href="/extension" target="_blank" rel="noopener">extension</a>. It is super easy, one click and you get gas/history from your favorite network.`],
        [`I would love to get Owlracle's predictions on my community group. Do you have anything for that?`,
        `Sure we do! You can integrate our <a href="/telegrambot" target="_blank" rel="noopener">Telegram bot</a> or <a href="discordbot" target="_blank" rel="noopener">Discord bot</a> bots directly into your groups, so your people can easily get Owlracle's predictions.`],
        [`I saw tweets from Owlracle about gas. How can I get it to send me gas for my favorite network?`,
        `You just have to make a tweet mentioning <a href="https://twitter.com/owlracleapi" target="_blank" rel="noopener">@owlracleapi</a>, use the hashtag #gas and the name/token of your favorite network. e.g. polygon, ftm, bsc, etc.`],
        [`My app have thousands of users making requests to your API. The API limit seems too low.`,
        `You should never call our API from the frond-end. Schedule your server to retrieve information at time intervals of your choice, then when your users request it, just send the cached data to them.`],
        [`Shouldn't I be worried if users peek into my app's source-code and discover my API key?`,
        `Do not EVER expose your API key on the front-end. If you do so, users will be able to read your source-code then make calls using your API (thus expending all your credits). Retrieve our data from your server back-end, then provide the cached data to your users when they request it.`],
        [`My API key have been exposed. What should I do?`,
        `You can reset your API key hash and generate a new one <a id="link-info-key">clicking here</a>.`],
        [`I am reaching API rate limit. How can I make a recharge and keep using Owlracle?`,
        `On the header there is a place where you can <a id="link-info-key">login</a> with your API key. After the login, you can click on <i>Recharge key</i> option. From there you will be asked to connect your Metamask wallet. Then you can transfer any amount of tokens to recharge your key.`],
        [`I need to retrieve gas info for several chains. Do I need to make a recharge on every network?`,
        `No! Once you recharge your key, the current token price is converted to USD and stored on your API key account as credit. Every time you request our endpoints (past the free limit) credit is subtracted from your API credit, regardless of which tokens were used when recharging the key. The current token price does not matter either, as they are converted to USD at the time of the recharge.`],
    ],

    getList: function() {
        return this.list;
    },

    setList: function(list) {
        this.list = list;
        this.rebuild();
    },

    rebuild: function(){
        document.querySelector('#faq').innerHTML = `<ul>${this.list.map(e => `<li><ul><li class="question"><i class="fas fa-angle-right"></i>${e[0]}</li><li class="answer">${e[1]}</li></ul></li>`).join('')}</ul>`;
        document.querySelectorAll('#faq .question').forEach(e => e.addEventListener('click', () => e.parentNode.classList.toggle('open')));
        
        document.querySelectorAll('#link-info-key').forEach(e => e.addEventListener('click', () => api.showProfile('info')));
        document.querySelectorAll('#faq .token-name').forEach(e => e.innerHTML = network.token);
        
        // smooth scrolling when clicking link
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
            });
        });        
    }
};
faq.rebuild();


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


class EndpointTable {
    constructor(obj, { endpoint, args, response, placeholder, network }) {
        this.obj = obj;
        this.network = network;
        this.endpoint = endpoint;
        this.url = endpoint;
        this.params = {};

        obj.classList.add('endpoint-table');

        const tabs = `<div class="tabs"><div class="tab active"><i class="fas fa-comment-alt"></i><span>Arguments</span></div><div class="tab"><i class="fas fa-robot"></i><span>Response</span></div><div class="tab"><i class="fas fa-play"></i><span>Sandbox</span></div></div>`;
        const content = `<div class="content">
            <div class="arguments item active"></div>
            <div class="response item">
                <div class="description"></div>
                <div class="sample"></div>
            </div>
            <div class="sample item">
                <div class="run-container">
                    <span class="url">${this.endpoint}</span>
                    <div class="button-container">
                        <div class="run"><i class="fas fa-play"></i></div>
                        <div class="open"><i class="fas fa-external-link-alt"></i></div>
                        <div class="copy"><i class="fas fa-copy"></i></div>
                    </div>
                </div>
                <div class="response"><div class="code"></div></div>
                <div class="arguments"></div>
            </div>
        </div>`;
        obj.innerHTML = `${tabs}${content}`;

        // create tooltips for buttons
        new Tooltip(obj.querySelector('.sample .button-container .copy'), 'Copy', { delay: 1000, createEvent: 'mouseenter' });
        new Tooltip(obj.querySelector('.sample .button-container .open'), 'Open', { delay: 1000, createEvent: 'mouseenter' });
        new Tooltip(obj.querySelector('.sample .button-container .run'), 'Call Endpoint', { delay: 1000, createEvent: 'mouseenter' });

        // action for switching tabs
        const tabsDOM = obj.querySelectorAll('.tabs .tab');
        tabsDOM.forEach((tab, i) => tab.addEventListener('click', () => {
            if (!tab.classList.contains('active')) {
                tabsDOM.forEach(e => e.classList.remove('active'));
                obj.querySelectorAll('.content .item').forEach(e => e.classList.remove('active'));

                tab.classList.add('active');
                obj.querySelectorAll('.content .item')[i].classList.add('active');
            }
        }));

        this.addArguments(args);
        this.addResponse(response, placeholder);
        this.addSample(args);
        this.changeURL({});
    }

    changeURL(url) {
        const query = new URLSearchParams(url).toString();
        const params = Object.keys(this.params).length ? '/'+ Object.values(this.params).join('/') : '';
        this.url = `${this.endpoint}${params}${query.length ? `?${query}` : ''}`;
        this.obj.querySelector('.sample .url').innerHTML = this.url;
        const net = this.network ? '/'+ network.symbol : '';
        this.link = `${location.origin}${net}${this.url}`;
    }

    addSample(data){
        const url = {};
        const sample = this.obj.querySelectorAll('.content .item')[2];
        let domSample = '';
        const that = this;

        data.forEach(e => {
            // sample body
            const def = (value => {
                if (value === undefined){
                    return ['', ''];
                }
                if (typeof value === 'object'){
                    return [value.text, value.value];
                }
                return [value, value];
            })(e.default);
            domSample += `<label><input type="checkbox" class="checkbox" ${e.required ? 'checked disabled' : ''}><span class="key-name">${e.name}</span></label><input type="text" class="input" placeholder="${def[0]}" value="${def[1]}" ${e.required ? '' : 'disabled'}>`;

            if (e.param){
                this.params[e.name] = '';
            }
        });

        sample.querySelector('.arguments').innerHTML = domSample;

        // sample checkbox change
        sample.querySelectorAll('.checkbox').forEach(e => e.addEventListener('change', function() {
            const index = [...sample.querySelectorAll('.checkbox')].indexOf(this);
            const input = sample.querySelectorAll('.input')[index];
            const arg = sample.querySelectorAll('.key-name')[index].textContent;

            if (this.checked){
                input.removeAttribute('disabled');
                if (input.value.length){
                    url[arg] = input.value;
                }
            }
            else {
                input.setAttribute('disabled', true);
                delete url[arg];
            }

            that.changeURL(url);
        }));

        // sample input change
        sample.querySelectorAll('.input').forEach(e => e.addEventListener('input', function() {
            const item = this.closest('.item');
            const index = [...item.querySelectorAll('.input')].indexOf(this);
            const arg = item.querySelectorAll('.key-name')[index].textContent;
            if (Object.keys(that.params).includes(arg)){
                that.params[arg] = this.value;
            }
            else if (this.value.length){
                url[arg] = this.value;
            }
            else {
                delete url[arg];
            }
            
            that.changeURL(url);
        }));

        // open link button
        sample.querySelector('.run-container .open').addEventListener('click', () => window.open(this.link));

        // copy link button
        sample.querySelector('.run-container .copy').addEventListener('click', () => {
            navigator.clipboard.writeText(this.link);
            const box = sample.querySelector('.run-container');
            box.classList.add('copy');
            setTimeout(() => box.classList.remove('copy'), 200);
        });

        // run button
        sample.querySelector('.run-container .run').addEventListener('click', async () => {
            const dom = sample.querySelector('.response');
            dom.innerHTML = `<div class="code"><i class="fas fa-spin fa-cog"></i></code>`;

            const response = await (await fetch(this.link)).json();
            dom.innerHTML = `<div class="code">${JSON.toHTML(response)}</div>`;
        })

        return this;
    }

    addArguments(data) {
        // head for args
        let domArgs = '<div class="cell head">Field</div><div class="cell head">Description</div><div class="cell head">Default</div>';

        data.forEach(e => {
            // args body
            const def = e.default === undefined ? '<i>none</i>' : typeof e.default === 'object' ? `<i>${e.default.text}</i>` : e.default;
            domArgs += `<div class="cell">${e.name}</div><div class="cell"><span>${e.description}</span></div><div class="cell">${def}</div>`
        });
        
        this.obj.querySelectorAll('.content .item')[0].innerHTML = domArgs;
        
        return this;
    }

    addResponse(description, url) {
        let dom = '<div class="cell head">Field</div><div class="cell head">Description</div>';
        description.forEach(e => dom += `<div class="cell">${e.name}</div><div class="cell"><span>${e.description}</span></div>`);
        
        const respDOM = this.obj.querySelectorAll('.content .item')[1];
        respDOM.querySelector('.description').innerHTML = dom;

        respDOM.querySelector('.sample').innerHTML = `<div class="code">${JSON.toHTML(url)}</div>`;
        
        return this;
    }
}


// create all endpoint tables
(() => {
    const now = parseInt(new Date().getTime() / 1000);

    const gasTable = {
        response: [
            { name: 'timestamp', description: 'An <a href="https://www.w3.org/TR/NOTE-datetime" target="_blank" rel="noopener nofollow">ISO 8601</a> compliant date for when the API returned the result.' },
            { name: 'baseFee', description: 'Average base fee from the scanned blocks. This field is only available if the network is <a href="https://notes.ethereum.org/@vbuterin/eip-1559-faq" target="_blank" rel="noopener nofollow">EIP-1559</a> compliant.' },
            { name: 'lastBlock', description: 'Number of the last block Owlracle scanned.' },
            { name: 'avgTime', description: 'Average time between each block confirmation.' },
            { name: 'avgTx', description: 'Average number of transactions in the blocks.' },
            { name: 'avgGas', description: 'Average gas used on transactions in the scanned blocks.' },
            { name: 'speeds', description: 'Array containing information of every speed requested in the <code class="code inline">accept</code> param.' },
            { name: 'acceptance', description: 'Ratio of blocks accepting transactions with the suggested gas fee. This value will always be >= the requested speed from the accept argument.' },
        ],

        placeholder: {
            "timestamp": "0000-00-00T00:00:00.000Z",
            "baseFee": 0.0,
            "lastBlock": 0,
            "avgTime": 0.0,
            "avgTx": 0.0,
            "avgGas": 0.0,
            "speeds": [{
                "acceptance": 0.0,
            }]
        },
    }

    if (network.nonevm) {
        gasTable.response.push(
            { name: 'fee', description: 'Suggested gas fee (in native network token) to be accepted in at least the requested percentage of blocks. This value is reported in <code class="code inline">1e-6</code> tokens.' },
            { name: 'estimatedGasPrice', description: 'The calculated gas price for the current fee and average gas used. Value reported is multiplied by <code class="code inline">1e9</code>.' },
            { name: 'feeUSD', description: 'The same as fee argument, but converted to USD, using current native token price.' },
        );
        gasTable.placeholder.speeds[0].fee = 0;
        gasTable.placeholder.speeds[0].estimatedGasPrice = 0.0;
        gasTable.placeholder.speeds[0].feeUSD = 0.0;
    }
    else {
        gasTable.response.push(
            { name: 'gasPrice', description: 'Suggested gas price (in GWei) to be accepted in at least the requested percentage of blocks.' },
            { name: 'estimatedFee', description: 'Estimated fee (in USD) you should pay when using the suggested gas price. This fee is calculated using the current token price and <code class="code inline">avgGas</code> value.' },
        );
        gasTable.placeholder.speeds[0].gasPrice = 0.0;
        gasTable.placeholder.speeds[0].estimatedFee = 0.0;
    }

    new EndpointTable(document.querySelector('#table-gas'), {
        endpoint: '/gas',
        network: true,
        args: [
            { name: 'apikey', description: 'You API key. Check <a href="#api-keys-sec">API keys</a> section to learn how to generate and use one.' },
            { name: 'blocks', default: 200, description: 'Number of past blocks you want Owlracle to scan to build the estimation. <i>Maximum 1000</i>.' },
            { name: 'percentile', default: 0.3, description: 'Block gas percentile. For every analyzed block, Owlracle calculates the minimum gas needed to be accepted on that block. Taking an array with asceding gas from the block\'s txs, the percentile argument tells Owlracle the array\'s index to be considered the first element, essentially discarding lower gas txs from the minimum accepted gas calculations. The value must be between 0.01 and 0.99 indicating a percentage from the array\'s position, or an integer >= 1 indicating directly the tx index in the array.' },
            { name: 'accept', default: '35,60,90,100', description: 'Acceptance threshold of transactions. The percentage of blocks you want the transaction to be accepted, based on the past mined blocks. Higher acceptance means more speedy transactions. You can provide a single value or a comma separated list of values, representing multiple speeds.' },
            { name: 'version', default: 2, description: 'Version of the api you want to request.' },
        ],
        response: gasTable.response,
        placeholder: gasTable.placeholder,
    });

    new EndpointTable(document.querySelector('#table-history'), {
        endpoint: '/history',
        network: true,
        args: [
            { name: 'apikey', description: 'You API key. Check <a href="#api-keys-sec">API keys</a> section to learn how to generate and use one.' },
            { name: 'from', default: 0, description: '<a href="https://www.unixtimestamp.com/" target="_blank" rel="noopener nofollow">Unix timestamp</a> representing the time where your search will start from.' },
            { name: 'to', default: { text: 'Current timestamp', value: now }, description: 'Unix timestamp representing the time where to finish your search.' },
            { name: 'candles', default: 100, description: 'How many results (maximum) you wish the search to retrieve. <i>Maximum 1000</i>.' },
            { name: 'page', default: 1, description: 'If the time range of your search returns more than <i>candles</i> values, you must inform the page of the search you wish to retrieve.' },
            { name: 'timeframe', default: 30, description: 'The time you wish to aggregate results to form candles. The allowed values are 10m, 30m, 1h, 2h, 4h or 1d. You could also inform these values in minutes (10, 30, 60, 120, 240, or 1440).' },
            { name: 'tokenprice', default: { value: false, text: 'false'}, description: 'Whether you want or not to receive the native network token price history in the request.' },
            { name: 'txfee', default: { value: false, text: 'false'}, description: 'Whether you want or not to receive the historic average gas paid (in USD) in the request.' },
        ],
        response: [
            { name: 'timestamp', description: 'An ISO 8601 compliant date for the candlestick time.' },
            { name: 'samples', description: 'Number of samples composing the candle.' },
            { name: 'avgGas', description: 'Average gas limit set for transactions in the blocks composing the candle.' },
            { name: 'gasPrice', description: 'Object containing information about gas price paid in the blocks composing the candle.' },
            { name: 'tokenPrice', description: 'Object containing information about network\'s native token price at the time. <i>Only present if <code class="code inline">tokenprice</code> argument is set to <code class="code inline">true</code></i>' },
            { name: 'txFee', description: 'Object containing information about average gas fee paid (in USD) for submitting a transaction at the time. <i>Only present if <code class="code inline">txfee</code> argument is set to <code class="code inline">true</code></i>' },
            { name: 'open', description: 'The data reported on the first moment of the candle.' },
            { name: 'close', description: 'The data reported on the last moment of the candle.' },
            { name: 'low', description: 'The lowest data reported on the entire candle.' },
            { name: 'high', description: 'The highest data reported on the entire candle.' },
        ],
        placeholder: [{
            timestamp: "0000-00-00T00:00:00.000Z",
            samples: 0,
            avgGas: 0,
            gasPrice: { open: 0, close: 0, low: 0, high: 0 },
            tokenPrice: { open: 0, close: 0, low: 0, high: 0 },
            txFee: { open: 0, close: 0, low: 0, high: 0 }
        }],

    });

    new EndpointTable(document.querySelector('#table-keys'), {
        endpoint: '/keys',
        args: [
            { name: 'YOUR_API_KEY', required: true, param: true, description: 'You API key. Check <a href="#api-keys-sec">API keys</a> section to learn how to generate and use one. <i>Required</i>.' },
        ],
        response: [
            { name: 'apiKey', description: 'Your API key.' },
            { name: 'creation', description: 'An ISO 8601 compliant date for the time the API key was created.' },
            { name: 'wallet', description: 'Your API wallet. You should transfer <span class="token-name"></span> to this address to recharge your credit.' },
            { name: 'credit', description: 'The amount of your unspent credit (in USD).' },
            { name: 'origin', description: 'Your requests will only be processed if the request\'s origin match your API key origin field. This field will not be present if you did not fill an origin when creating the API key.' },
            { name: 'note', description: 'A personal informative note about the key. This field will only be present if you filled a note when creating your key.' },
            { name: 'usage', description: 'The API key Usage.' },
            { name: 'apiKeyHour', description: 'Requests made using your API key in the last hour.' },
            { name: 'apiKeyTotal', description: 'Total requests made using your API key.' },
        ],
        placeholder: {
            apiKey: "00000000000000000000000000000000",
            creation: "0000-00-00T00:00:00.000Z",
            wallet: "0x0000000000000000000000000000000000000000",
            credit: "0.000000000",
            origin: "domain.com",
            note: "note to myself",
            usage: {
                apiKeyHour: 0,
                apiKeyTotal: 0
            }
        },
    });

    new EndpointTable(document.querySelector('#table-credit'), {
        endpoint: '/credit',
        args: [
            { name: 'YOUR_API_KEY', required: true, param: true, description: 'You API key. Check <a href="#api-keys-sec">API keys</a> section to learn how to generate and use one. <i>Required</i>.' },
        ],
        response: [
            { name: 'network', description: 'Network the transaction was sent. <i>Possible values: "bsc", "poly", "ftm", "avax", "eth"</i>.' },
            { name: 'tx', description: 'The transaction hash of your deposit. You can check the network\'s block explorer for details about the transaction.' },
            { name: 'timestamp', description: 'An ISO 8601 compliant date for the time of the transaction.' },
            { name: 'value', description: 'Credit deposited in <span class="token-name"></span> in Gwei (1 Gwei = 0.000000001 <span class="token-name"></span>).' },
            { name: 'price', description: '<span class="token-name"></span>/USDT price at the time of the transaction.' },
            { name: 'fromWallet', description: 'The wallet that sent the credit to your API wallet.' },
        ],
        placeholder: {
            message: "success",
            results: [{
                network: "xxx",
                tx: "0x0000000000000000000000000000000000000000000000000000000000000000",
                timestamp: "2000-00-00T00:00:00.000Z",
                value: "0",
                price: "0",
                fromWallet: "0x0000000000000000000000000000000000000000"
            }]
        },
    });

    new EndpointTable(document.querySelector('#table-logs'), {
        endpoint: '/logs',
        args: [
            { name: 'YOUR_API_KEY', required: true, param: true, description: 'You API key. Check <a href="#api-keys-sec">API keys</a> section to learn how to generate and use one. <i>Required</i>.' },
            { name: 'fromtime', default: { text: 'One hour in the past', value: now - 3600 }, description: 'The time (unix timestamp) you want to start your search.' },
            { name: 'totime', default: { text: 'Current timestamp', value: now }, description: 'The time (unix timestamp) you want to end your search.' },
        ],
        response: [
            { name: 'ip', description: 'The ip address of the request. <code class="code inline">null</code> if the request was made from a private ip.' },
            { name: 'origin', description: 'The origin of the request. This is the domain (the website name) that originates the request. <code class="code inline">null</code> if the request did not originate from a website (or called from the client browser).' },
            { name: 'timestamp', description: 'An ISO 8601 compliant date for the time of the transaction.' },
            { name: 'endpoint', description: 'The endpoint requested. <i>Possible values: "gas", "history"</i>.' },
            { name: 'network', description: 'Network of the information requested. <i>Possible values: "bsc", "poly", "ftm", "avax", "eth"</i>.' },
        ],
        placeholder: [{
            ip: "255.255.255.255",
            origin: "domain.com",
            timestamp: "0000-00-00T00:00:00.000Z",
            endpoint: "xxx",
            network: "xxx"
        }],

    });

    document.querySelectorAll('.token-name').forEach(e => e.innerHTML = network.token);
})();


// deal with a pending recharge
(async () => {
    if (cookies.get('pending-tx-recharge')) {
        const toastAccept = new Toast(`<i class="fas fa-spin fa-cog"></i><span> You have a pending recharge... I will check this for you... 🦉</span>`, { timeOut: 0, position: 'center' });

        // import web3 from cdn
        await new Promise(resolve => new DynamicScript('https://cdnjs.cloudflare.com/ajax/libs/web3/1.7.1/web3.min.js', () => resolve(true)));
        const web3 = (await import('./web3.min.js')).default;
        await web3.init();

        const { hash, apikey } = cookies.get('pending-tx-recharge', true);
        const confirm = await web3.waitConfirmation(hash);
        toastAccept.fade(0);
        cookies.delete('pending-tx-recharge');

        if (confirm.error) {
            new Toast(`Sorry! I could not verify your recharge. Go to our <a href="https://discord.gg/bHckPMw3Qu" target="_blank" aria-label="discord server" rel="noopener">Discord server</a> and inform the tx hash so I can make things right for you.`, { timeOut: 10000, position: 'center' });
            return;
        }

        new Toast(`Transaction found. <a href="${ Network.get().explorer.href }/tx/${ hash }" target="_blank" aria-label="view transaction" rel="noopener">View in explorer</a>.`, { timeOut: 15000, position: 'center' });

        let toastUpdate = new Toast(`<i class="fas fa-spin fa-cog"></i><span> Updating your API credit...</span>`, { timeOut: 0, position: 'center' });
        const data = await api.updateCredit({
            apiKey: apikey,
            transactionHash: hash,
        });
        toastUpdate.fade(1000);

        if (data.status == 200) {
            let bonus = '';
            if (data.bonus) {
                bonus = ` (<span class="green">+$${ parseFloat(data.bonus).toFixed(4) }</span> bonus)`;
            }
            new Toast(`🦉 Your API credit was increased by <span class="green">$${ parseFloat(data.amount.usd).toFixed(4) }</span>${bonus}. Thanks!`, { timeOut: 10000, position: 'center' });
            return;
        }

        new Toast(`🦉 Something want wrong while updating your credit. Please go to our <a href="https://discord.gg/bHckPMw3Qu" target="_blank" aria-label="discord server" rel="noopener">Discord server</a> and inform us about this issue.`, { timeOut: 10000, position: 'center' });
        return;
    }
})();