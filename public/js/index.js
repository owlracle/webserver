// request google recaptcha v3 token
const recaptcha = {
    ready: false,
    loading: false,

    load: async function() {
        if (this.ready){
            return true;
        }
        else if (this.loading){
            return new Promise(resolve => setTimeout(() => resolve(this.load()), 10));
        }

        this.loading = true;

        this.key = document.querySelector('#recaptchakey').value;

        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${this.key}`;
        script.async = true;

        document.head.appendChild(script);

        return new Promise( resolve => script.onload = () => {
            this.ready = true;
            resolve(true);
        });
    },

    getToken: async function() {
        await this.load();
        return new Promise(resolve => grecaptcha.ready(() => grecaptcha.execute(this.key, { action: 'submit' }).then(token => resolve(token))));
    }
}
recaptcha.load();


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


// load a custom script on window object
class DynamicScript {
    constructor(url, onload) {
        const script = document.createElement('script');
        script.onload = onload;
        script.src = url;
        script.async = true;

        document.head.appendChild(script);
    }
}
new DynamicScript('https://kit.fontawesome.com/c1a16f97ec.js');


// set the cookie utils object

const cookies = {
    set: function(key, value, {expires, path}={}) {
        if (!expires){
            expires = 86400000;
        }
        if (!path){
            path = '/';
        }

        let expTime = 0;
        if (typeof expires === "object"){
            expTime += (expires.seconds * 1000) || 0;
            expTime += (expires.minutes * 1000 * 60) || 0;
            expTime += (expires.hours * 1000 * 60 * 60) || 0;
            expTime += (expires.days * 1000 * 60 * 60 * 24) || 0;
        }
        else {
            expTime = expires;
        }

        const now = new Date();
        expTime = now.setTime(now.getTime() + expTime);

        const cookieString = `${key}=${value};expires=${new Date(expTime).toUTCString()};path=${path}`;
        document.cookie = cookieString;
        return cookieString;
    },

    get: function(key) {
        const cookies = document.cookie.split(';').map(e => e.trim());
        const match = cookies.filter(e => e.split('=')[0] == key);
        return match.length ? match[0].split('=')[1] : false;
    },

    delete: function(key) {
        const cookies = document.cookie.split(';').map(e => e.trim());
        const match = cookies.filter(e => e.split('=')[0] == key);

        document.cookie = `${key}=0;expires=${new Date().toUTCString()}`;
        return match.length > 0;
    }
};


// fetch bnb price from binance and update the pages's ticker

const price = {
    current: 0,
    element: document.querySelector('#price'),
    token: 'BNB',

    get: async function() {
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${this.token}USDT`;
        const url24 = `https://api.binance.com/api/v3/ticker/24hr?symbol=${this.token}USDT`;

        const price = (await (await fetch(url)).json()).price;
        const price24h = (await (await fetch(url24)).json()).priceChangePercent;

        return {
            now: parseFloat(price).toFixed(2),
            changePercent: parseFloat(price24h).toFixed(2), 
        }
    },

    update: async function() {
        this.current = await this.get();

        if (this.current.changePercent < 0){
            this.element.querySelector('#color').classList.remove('green');
            this.element.querySelector('#color').classList.add('red');
        }
        else {
            this.element.querySelector('#color').classList.remove('red');
            this.element.querySelector('#color').classList.add('green');
            this.current.changePercent = `+${this.current.changePercent}`;
        }

        this.element.querySelector('#now').innerHTML = this.current.now;
        this.element.querySelector('#before').innerHTML = this.current.changePercent;
    }
};


// search api key button

document.querySelector('#search #api-info').addEventListener('click', async () => {
    const glyph = document.querySelector('#search #api-info i');
    glyph.classList.remove('fa-search');
    glyph.classList.add('fa-spin', 'fa-cog');

    const input = document.querySelector('#search input');
    input.setAttribute('disabled', true);

    const key = input.value.trim().toLowerCase();
    if (key.match(api.regex.apiKey)){
        const data = await api.getKey(key);
        api.showModal();
        api.showWindowInfo(data);

    }
    glyph.classList.remove('fa-spin', 'fa-cog');    
    glyph.classList.add('fa-search');
    input.removeAttribute('disabled');
    input.value = '';
});

document.querySelector('#search input').addEventListener('keyup', e => {
    if (e.key == 'Enter'){
        document.querySelector('#search #api-info').click();
    }
});

document.querySelector('#search #drop').addEventListener('click', async function() {
    const dropdown = document.createElement('div');
    dropdown.id = 'dropdown';

    dropdown.innerHTML = `
        <div id="create-key" class="item">Create API key</div>
        <div id="edit-key" class="item">Edit API key</div>
        <div id="info-key" class="item">API key info</div>
    `;

    dropdown.style.top = `${this.offsetTop + this.clientHeight}px`;
    dropdown.style.left = `${this.offsetLeft + this.clientWidth - 130}px`;

    dropdown.querySelectorAll('.item').forEach(e => e.addEventListener('click', () => api.showModal(e.id.split('-')[0])));
    
    const fog = document.createElement('div');
    fog.id = 'fog';
    fog.classList.add('invisible');


    document.body.appendChild(fog);
    fog.appendChild(dropdown);

    fog.addEventListener('click', () => fog.remove());
});


// function bscScanSearch() {
//     const input = document.querySelector('#search input');
//     const url = `https://bscscan.com/search?q=`;

//     if (input.value.length > 0){
//         window.open(`${url}${input.value}`);
//     }
//     input.value = '';
// }


// create modal about donation

const wallet = {
    address: '0xA6E126a5bA7aE209A92b16fcf464E502f27fb658',

    loadImg: async function(elem, network) {
        return new Promise(resolve => {
            this.img = new Image();
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=`;

            this.shortAddress = `${this.address.slice(0,6)}...${this.address.slice(-4)}`;
            elem.querySelector('#wallet').innerHTML = `<span class="long">${this.address}</span><span class="short">${this.shortAddress}</span>`;

            this.img.src = `${url}${this.address}`;
    
            this.img.onload = () => {
                elem.classList.remove('disabled');
                elem.addEventListener('click', () => this.showModal(network));
                resolve(this.img)
            };
        });
    },

    bindModal: function(elem, network) {
        elem.addEventListener('click', () => this.showModal(network));
    },

    showModal: function(network){
        const fog = document.createElement('div');
        fog.id = 'fog';
        fog.innerHTML = `<div id="donate-window" class="${network.symbol}">
            <div id="title">
                <span>${network.longName ? `${network.longName} (${network.name})` : network.name}</span>
                <span class="big">${network.token} Wallet</span>
            </div>
            <div id="qr"><img src="${this.img.src}"></div>
            <div id="colored">
                <div id="wallet-container">
                    <div id="wallet">${this.shortAddress}</div>
                    <div id="copy"><i class="far fa-copy"></i></div>
                </div>
            </div>
        </div>`;

        fog.addEventListener('click', () => fog.remove());
        fog.querySelector('div').addEventListener('click', e => e.stopPropagation());
    
        fog.querySelector('#wallet-container').addEventListener('click', () => this.copyAddress());

        document.body.appendChild(fog);
        fadeIn(fog, 500);
    },

    copyAddress: function(){
        const elem = document.querySelector('#fog #wallet');
        const oldText = elem.innerHTML;
        elem.innerHTML = `COPIED`;

        const container = document.querySelector('#fog #wallet-container');
        container.classList.add('copy');

        setTimeout(() => {
            elem.innerHTML = oldText;
            container.classList.remove('copy');
        }, 500);

        navigator.clipboard.writeText(this.address);
    }
};


// fade in and out function (work on any element)

async function fadeIn(elem, time=300){
    return new Promise(resolve => {
        const oldStyle = elem.getAttribute('style');
        elem.style.transition = `${time/1000}s opacity`;
        elem.style.opacity = '0';
    
        setTimeout(() => elem.style.opacity = '1', 1);
        setTimeout(() => {
            elem.removeAttribute('style');
            elem.style = oldStyle;
            resolve(true);
        }, time + 100);
    });
}

async function fadeOut(elem, time=300){
    return new Promise(resolve => {
        elem.style.transition = `${time/1000}s opacity`;
        
        setTimeout(() => elem.style.opacity = '0', 1);
        setTimeout(() => {
            elem.remove();
            resolve(true);
        }, time + 100);
    });
}


// set the corresponding network in header
// place elements specific to the network

const network = (symbol => {
    const networks = {
        eth: { symbol: 'eth', name: 'Ethereum', token: 'ETH', explorer: {
            icon: 'https://etherscan.io/images/favicon3.ico', href: 'https://etherscan.io/', name: 'Etherscan'
        } },
        avax: { symbol: 'avax', name: 'Avalanche', token: 'AVAX', explorer: {
            icon: 'https://explorer.avax.network/favicon.ico', href: 'https://explorer.avax.network/', name: 'Avalanche Explorer'
        } },
        poly: { symbol: 'poly', name: 'Polygon', token: 'MATIC', explorer: {
            icon: 'https://polygonscan.com/images/favicon.ico', href: 'https://polygonscan.com/', name: 'PolygonScan'
        } },
        ftm: { symbol: 'ftm', name: 'Fantom', token: 'FTM', explorer: {
            icon: 'https://ftmscan.com/images/favicon.png', href: 'https://ftmscan.com/', name: 'FtmScan'
        } },
        bsc: { symbol: 'bsc', name: 'BSC', longName: 'Binance Smart Chain', token: 'BNB', explorer: {
            icon: 'https://bscscan.com/images/favicon.ico', href: 'https://bscscan.com/', name: 'BscScan'
        } },
    };

    // no network set, redirect to last network
    if (symbol == ''){
        location.href = '/' + cookies.get('network') || 'bsc';
        return;
    }
    
    cookies.set('network', symbol, { expires: { days: 365 } });
    const network = networks[symbol];
    network.symbol = symbol;

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
    
        dropdown.innerHTML = Object.entries(networks).filter(([k,v]) => k != symbol).map(([k,v]) => `<div id="${k}" class="item"><img class="icon" src="img/${k}.png"><span class="name">${v.name}</span></div>`).join('');
    
        dropdown.style.top = `${this.offsetTop + this.clientHeight}px`;
        dropdown.style.left = `${this.offsetLeft + this.clientWidth - 130}px`;
    
        dropdown.querySelectorAll('.item').forEach(e => e.addEventListener('click', () => window.location.href = `/${e.id}`));
        
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

    return network;
})(document.querySelector('#network').value);


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
chart.init();


// change theme dark/light
const theme = {
    options: ['dark', 'light'],
    icons: {
        dark: 'sun',
        light: 'moon'
    },
    choice: 'dark',
    particles: true,

    set: function(name){
        if (this.options.includes(name)){
            const oldName = this.choice;
            document.body.classList.remove(this.choice);
            document.body.classList.add(name);
            this.choice = name;
            cookies.set('theme', name, { expires: { days: 365 } });
            document.querySelector('header #theme').innerHTML = `<i class="fas fa-${this.icons[name]}"></i>`;
            chart.setTheme(name);
            
            if (oldName != name && window.__CPEmbed){
                codePens.forEach(e => e.update());
            }
            
            // already loaded, reload
            if (typeof tsParticles !== 'undefined' && cookies.get('particles') == 'true'){
                tsParticles.loadJSON('frame', `config/particles-${name}.json`)
            }
        }
    },

    load: function() {
        this.set(cookies.get('theme') || this.choice);

        cookies.set('particles', cookies.get('particles') || this.particles, { expires: { days: 365 } });
        if (cookies.get('particles') == 'true'){
            // particles background
            new DynamicScript('https://cdn.jsdelivr.net/npm/tsparticles@1.9.2/dist/tsparticles.min.js', () => tsParticles.loadJSON('frame', `config/particles-${this.choice}.json`));
        }
        else if (document.querySelector('canvas.tsparticles-canvas-el')){
            document.querySelector('canvas.tsparticles-canvas-el').remove();
        }
    },

    toggle: function() {
        const index = this.options.indexOf(this.choice);
        const next = this.options[ (index + 1) % this.options.length ];
        this.set(next);
    },

    get: function() {
        return this.choice;
    }
};
theme.load();
document.querySelector('#theme').addEventListener('click' , () => theme.toggle());

document.querySelector('#toggle-bg').addEventListener('click' , () => {
    cookies.set('particles', cookies.get('particles') == 'false', { expires: { days: 365 } });
    theme.load();
});


// tooltip class

class Tooltip {
    constructor(parent, text, {
        createEvent = 'click',
        killEvent = 'mouseleave',
        delay = 0,
        timeout = null,
    }={}) {
        this.parent = parent;

        if (!text){
            text = parent.title;
            parent.removeAttribute('title');
        }
        this.text = text;

        this.parent.addEventListener(createEvent, e => {
            this.pendingCreate = true;
            setTimeout(() => {
                if (this.pendingCreate){
                    this.create(e);
                }
            }, delay);

            if (timeout){
                setTimeout(() => this.kill(), timeout);
            }    
        });

        if (killEvent == 'mouseleave') {
            this.parent.addEventListener(killEvent, () => {
                this.pendingCreate = false;
                this.kill();
            });
        }


        return this;
    }

    create(event) {
        // console.log(event);
        const tooltip = document.createElement('div');
        this.element = tooltip;
        tooltip.classList.add('tooltip');
        tooltip.innerHTML = this.text;
        tooltip.style.top = `${event.y}px`;
        tooltip.style.left = `${event.x}px`;

        document.querySelectorAll('.tooltip').forEach(e => e.remove());

        this.parent.insertAdjacentElement('afterend', tooltip);

        // move tooltip more to the left if it reached window corner
        if (tooltip.offsetLeft + tooltip.offsetWidth > window.outerWidth){
            tooltip.style.left = `${event.x - tooltip.offsetWidth}px`;
        }

        fadeIn(tooltip, 200);
    }

    kill() {
        if (this.element){
            fadeOut(this.element, 200);
        }
    }

    setText(text) {
        this.text = text;
    }
}


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
        const startTime = new Date();
        const data = await (await fetch(`/${network.symbol}/gas?grc=${token}&sid=${sessionid}`)).json();
        const requestTime = new Date() - startTime;

        if (data.error){
            console.log(data);
            if (data.status == 401){
                this.stop = true;
                const fog = document.createElement('div');
                fog.id = 'fog';
                fog.innerHTML = `<div id="api-window"><div id="content">
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
            this.onUpdate(data, requestTime);
        }
        return data;    
    }
};
gasTimer.init(30000, 100);

gasTimer.onUpdate = function(data, requestTime){
    const speedList = ['slow', 'standard', 'fast', 'instant'];
    document.querySelectorAll('.gas .body').forEach((e,i) => {
        if (data.speeds){
            const gas = (gas => gas.toFixed(gas == parseInt(gas) ? 0 : 2))(data.speeds[i].gasPrice);
            const fee = data.speeds[i].estimatedFee.toFixed(4);
            e.querySelector('.gwei').innerHTML = `${gas} GWei`;
            e.querySelector('.usd').innerHTML = `$ ${fee}`;
        }
    });

    const sample = document.querySelector('#sample');
    if (!sample.classList.contains('loaded')){ 
        sample.innerHTML = JSON.toHTML(data);
        
        sample.classList.add('loaded');

        document.querySelector(`#timeframe-switcher #tf-60`).click();
        document.querySelector(`#toggle-container #gas`).click();
    }
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


const api = {
    regex: {
        url: new RegExp(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9._-]{1,256}\.[a-z0-9]{1,10})\b.*$/),
        apiKey: new RegExp(/^[a-f0-9]{32}$/),
    },

    createNewApiContent: function(){
        // create api key modal
        const tabsContent = this.tabsContent;
        tabsContent.create.innerHTML = `<h2>New API key</h2>
        <p class="title origin">Origin <i class="far fa-question-circle"></i></p>
        <input type="text" class="input-text" id="origin" placeholder="mywebsite.com">
        <span id="origin-tip" class="tip"></span>
        <p class="title note">Note <i class="far fa-question-circle"></i></p>
        <input type="text" class="input-text" id="note" placeholder="My personal note for this key">
        <div id="checkbox-container">
            <label>
                <input type="checkbox">
                <span>I agree to not share any of my API key information with others.</span>
            </label>
            <label>
                <input type="checkbox">
                <span>I am aware that front-end code is publicly readable and exposing my API key on it is the same as sharing them.</span>
            </label>
        </div>
        <div id="button-container"><button id="create-key" disabled>Create API key</button></div>`;
                
        tabsContent.create.querySelectorAll('#checkbox-container input').forEach(e => e.addEventListener('click', () => {
            if (Array.from(tabsContent.create.querySelectorAll('#checkbox-container input')).filter(e => e.checked).length == 2){
                tabsContent.create.querySelector('#create-key').removeAttribute('disabled');
            }
            else {
                tabsContent.create.querySelector('#create-key').setAttribute('disabled', true);
            }
        }));


        const urlRegex = this.regex.url;
        tabsContent.create.querySelector('#origin').addEventListener('keyup', () => {
            const value = tabsContent.create.querySelector('#origin').value.trim().toLowerCase();
            const match = value.match(urlRegex);
            if (match && match.length > 1){
                const tip = tabsContent.create.querySelector('#origin-tip');
                tip.innerHTML = '';
                tabsContent.create.querySelector('#origin').classList.remove('red');
            }
        });

        tabsContent.create.querySelector('#create-key').addEventListener('click', async function() {
            const body = {};
            let error = false;
            if (tabsContent.create.querySelector('#origin').value.length){
                // make sure origin informed is only then domain name
                const value = tabsContent.create.querySelector('#origin').value.trim().toLowerCase();
                const match = value.match(urlRegex);
                if (match && match.length > 1){
                    body.origin = value;
                }
                else{
                    const tip = tabsContent.create.querySelector('#origin-tip');
                    tip.innerHTML = 'Invalid domain';
                    tabsContent.create.querySelector('#origin').classList.add('red');
                    error = true;
                }
            }
            if (tabsContent.create.querySelector('#note').value.length){
                body.note = tabsContent.create.querySelector('#note').value.trim();
            }

            if (!error){
                this.setAttribute('disabled', true);
                this.innerHTML = '<i class="fas fa-spin fa-cog"></i>';
    
                body.grc = await recaptcha.getToken();
                const data = await api.createKey(body);
                api.showWindowCreate(data);
            }
        });
    },

    createEditApiContent: function(){
        // edit api key modal
        const tabsContent = this.tabsContent;
        tabsContent.edit.innerHTML = `<h2>Edit API key</h2>
        <p class="title">API Key</p>
        <input type="text" class="input-text keys" id="key" placeholder="00000000000000000000000000000000">
        <span id="key-tip" class="tip"></span>
        <p class="title">API Secret</p>
        <input type="text" class="input-text keys" id="secret" placeholder="00000000000000000000000000000000">
        <span id="secret-tip" class="tip"></span>
        <p class="title origin">Origin <i class="far fa-question-circle"></i></p>
        <input type="text" class="input-text" id="origin" placeholder="mywebsite.com">
        <span id="origin-tip" class="tip"></span>
        <p class="title note">Note <i class="far fa-question-circle"></i></p>
        <input type="text" class="input-text" id="note" placeholder="My personal note for this key">
        <div id="checkbox-container">
            <label>
                <input type="checkbox">
                <span>
                    <div>I want to reset my API key hash</div>
                    <div class='tip hidden'>WARNING: The current API key hash will not be usable anymore.</div>
                </span>
            </label>
        </div>
        <div id="button-container"><button id="edit-key">Save</button></div>`;

        const urlRegex = this.regex.url;
        const apiKeyRegex = this.regex.apiKey;

        tabsContent.edit.querySelector('#origin').addEventListener('keyup', function() {
            const value = this.value.trim().toLowerCase();
            const match = value.match(urlRegex);
            if (match && match.length > 1){
                const tip = tabsContent.edit.querySelector('#origin-tip');
                tip.innerHTML = '';
                tabsContent.edit.querySelector('#origin').classList.remove('red');
            }
        });

        tabsContent.edit.querySelectorAll('#key, #secret').forEach(e => e.addEventListener('keyup', function() {
            const value = this.value.trim().toLowerCase();
            if (value.match(apiKeyRegex)){
                const tip = tabsContent.edit.querySelector(`#${this.id}-tip`);
                tip.innerHTML = '';
                this.classList.remove('red');
            }
        }));

        tabsContent.edit.querySelector('#checkbox-container input').addEventListener('change', function() {
            const tip = this.parentNode.querySelector('.tip');
            if (this.checked){
                tip.classList.remove('hidden');
            }
            else{
                tip.classList.add('hidden');
            }
        });

        tabsContent.edit.querySelector('#edit-key').addEventListener('click', async function() {
            const body = {};
            let error = false;
            if (tabsContent.edit.querySelector('#origin').value.length){
                // make sure origin informed is only then domain name
                const value = tabsContent.edit.querySelector('#origin').value.trim().toLowerCase();
                const match = value.match(urlRegex);
                if (match && match.length > 1){
                    body.origin = value;
                }
                else{
                    const tip = tabsContent.edit.querySelector('#origin-tip');
                    tip.innerHTML = 'Invalid domain';
                    tabsContent.edit.querySelector('#origin').classList.add('red');
                    error = true;
                }
            }
            if (tabsContent.edit.querySelector('#note').value.length){
                body.note = tabsContent.edit.querySelector('#note').value.trim();
            }

            const key = tabsContent.edit.querySelector('#key').value.trim().toLowerCase();
            if (!key.match(apiKeyRegex)){
                const tip = tabsContent.edit.querySelector('#key-tip');
                tip.innerHTML = 'Invalid API key';
                tabsContent.edit.querySelector('#key').classList.add('red');
                error = true;
            }

            body.secret = tabsContent.edit.querySelector('#secret').value.trim().toLowerCase();
            if (!body.secret.match(apiKeyRegex)){
                const tip = tabsContent.edit.querySelector('#secret-tip');
                tip.innerHTML = 'Invalid API secret';
                tabsContent.edit.querySelector('#secret').classList.add('red');
                error = true;
            }

            const reset = tabsContent.edit.querySelector('#checkbox-container input').checked;
            if (reset){
                body.resetKey = true;
            }


            if (!error){
                this.setAttribute('disabled', true);
                this.innerHTML = '<i class="fas fa-spin fa-cog"></i>';
    
                const data = await api.editKey(key, body);
                api.showWindowEdit(data);
            }
        });
    },

    createInfoApiContent: function(){
        // get api key information
        const tabsContent = this.tabsContent;
        tabsContent.info.innerHTML = `<h2>API key information</h2>
        <p class="title">API key</p>
        <input type="text" class="input-text keys" id="key" placeholder="00000000000000000000000000000000">
        <span id="key-tip" class="tip"></span>
        <div id="button-container"><button id="get-key">Search</button></div>`;

        tabsContent.info.querySelector('#key').addEventListener('keyup', function() {
            const value = this.value.trim().toLowerCase();
            if (value.match(apiKeyRegex)){
                const tip = tabsContent.info.querySelector(`#key-tip`);
                tip.innerHTML = '';
                this.classList.remove('red');
            }
        });

        const apiKeyRegex = this.regex.apiKey;

        tabsContent.info.querySelector('#get-key').addEventListener('click', async function() {
            let error = false;

            const key = tabsContent.info.querySelector('#key').value.trim().toLowerCase();
            if (!key.match(apiKeyRegex)){
                const tip = tabsContent.info.querySelector('#key-tip');
                tip.innerHTML = 'Invalid API key';
                tabsContent.info.querySelector('#key').classList.add('red');
                error = true;
            }

            if (!error){
                this.setAttribute('disabled', true);
                this.innerHTML = '<i class="fas fa-spin fa-cog"></i>';

                const data = await api.getKey(key);
                api.showWindowInfo(data);
            }
        });
    },

    showWindowCreate: function(data){
        const modal = document.querySelector('#fog #api-window');
        if (data.apiKey){
            modal.innerHTML = `<div id="content">
                <h2>API key Created</h2>
                <p class="title">API Key</p>
                <div class="input-container">
                    <input type="text" class="input-text keys" value="${data.apiKey}" readonly>
                    <div class="input-button"><i class="far fa-copy"></i></div>
                </div>
                <p class="title">API Secret</p>
                <div class="input-container">
                    <input type="text" class="input-text keys" value="${data.secret}" readonly>
                    <div class="input-button"><i class="far fa-copy"></i></div>
                </div>
                <p class="title">Wallet</p>
                <div class="input-container">
                    <input type="text" class="input-text keys" value="${data.wallet}" readonly>
                    <div class="input-button"><i class="far fa-copy"></i></div>
                </div>
                <ul>
                    <li>Make sure to save this information before closing this window.</li>
                    <li>We do not store your key and secret in plain text, so we cannot recover them in case of loss.</li>
                </ul>
                <div id="button-container"><button id="close">OK</button></div>
            </div>`;
            // add buttons for clipboard copy info

            modal.querySelector('#close').addEventListener('click', () => modal.parentNode.remove());

            modal.querySelectorAll('.input-button').forEach(e => e.addEventListener('click', function(){
                const parent = this.closest('.input-container');
                api.copyText(parent);
            }));
        }
        else{
            modal.innerHTML = `<div id="content">
                <h2>${data.error || 'Message'}</h2>
                <p>${data.message}</p>
                <div id="button-container"><button id="close">OK</button></div>
            </div>`;

            modal.querySelector('#close').addEventListener('click', () => document.querySelector('#fog').click());
        }
    },

    showWindowEdit: function(data){
        const modal = document.querySelector('#fog #api-window');
        if (data.apiKey){
            const fields = Object.entries(data).filter(e => e[0] != 'apiKey' && e[0] != 'message').map(e => `<p class="title">${e[0]}</p><input type="text" class="input-text keys" value="${e[1]}" readonly>`).join('');

            modal.innerHTML = `<div id="content">
                <h2>API key information updated</h2>
                <p class="title">API Key</p>
                <input type="text" class="input-text keys" value="${data.apiKey}" readonly>
                ${fields}
                <div id="button-container"><button id="close">OK</button></div>
            </div>`;
        }
        else{
            modal.innerHTML = `<div id="content">
                <h2>${data.error || 'Message'}</h2>
                <p>${data.message}</p>
                <div id="button-container"><button id="close">OK</button></div>
            </div>`;
        }

        modal.querySelector('#close').addEventListener('click', () => modal.parentNode.remove());
    },

    showWindowInfo: function(data) {
        const modal = document.querySelector('#fog #api-window');
        if (data.apiKey){
            const key = data.apiKey;
            const fields = Object.entries(data).filter(e => e[0] != 'usage').map(e => {
                const label = e[0] == 'apiKey' ? 'API Key' : e[0];

                let value = e[1];
                if (e[0] == 'credit') {
                    value = `...`;
                }
                else if (e[0] == 'creation'){
                    value = new Date(e[1]).toISOString().replace('T', ' ').split('.')[0];
                }

                let input = `<input type="text" class="input-text keys" id="input-${label}" value="${value}" readonly>`;
                if (e[0] == 'wallet'){
                    input = `<div class="input-container">${input}<div id="copy" class="input-button" title="Copy"><i class="far fa-copy"></i></div></div>`;
                }
                else if (e[0] == 'credit'){
                    input = `<div class="input-container">${input}<div id="update" class="input-button" title="Update"><i class="fas fa-sync-alt"></i></div></div>`;
                }
                else if (e[0] == 'origin'){
                    input = `<div class="input-container">${input}<a id="open-link" class="input-button" title="Open Link" href="https://${value}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i></a></div>`;
                }
                return `<p class="title">${label}</p>${input}`;
            }).join('');

            modal.innerHTML = `<div id="content">
                <h2>API key information</h2>
                ${fields}
                <div id="button-container">
                    <button id="credit">History</button>
                    <button id="close">Close</button>
                </div>
            </div>`;

            modal.querySelector('#copy').addEventListener('click', function(){
                const parent = this.closest('.input-container');
                api.copyText(parent);
            });
            
            modal.querySelector('#update').addEventListener('click', function(){
                this.classList.add('clicked');
                setTimeout(() => this.classList.remove('clicked'), 700);
                modal.querySelector('#input-credit').value = '...';
                refreshCredit(key);
            });
            
            modal.querySelector('#credit').addEventListener('click', async () => {
                const data = await this.getCredit(key);
                this.showWindowCredit(key, data);
            });    

            async function refreshCredit(key){
                const modal = document.querySelector('#fog #api-window');
                if (modal && modal.querySelector('#input-credit')){
                    await api.updateCredit(key);
                    const data = await api.getKey(key);

                    // if even after await you are still on the same window
                    if (modal && modal.querySelector('#input-credit')){
                        modal.querySelector('#input-credit').value = `${(data.credit / 100000000).toFixed(8)} BNB`;
                        setTimeout(() => refreshCredit(key), 5000);
                    }
                }
            }
            refreshCredit(key);
        }
        else{
            modal.innerHTML = `<div id="content">
                <h2>${data.error || 'Message'}</h2>
                <p>${data.message}</p>
                <div id="button-container"><button id="close">OK</button></div>
            </div>`;
        }

        modal.querySelector('#close').addEventListener('click', () => document.querySelector('#fog').remove());
    },

    showWindowCredit: function(key, data) {
        const modal = document.querySelector('#fog #api-window');

        let txs = '<div class="empty">No transactions found. Try sending some BNB to your API wallet.</div>';
        if (data.results.length > 0){
            modal.classList.add('large');

            const tds = data.results.map(e => {
                return `<div class="row">
                    <div class="cell"><a href="https://bscscan.com/tx/${e.tx}" target="_blank">${e.tx.slice(0,6)}...${e.tx.slice(-4)}</a></div>
                    <div class="cell">${new Date(e.timestamp).toISOString().replace('T', ' ').split('.')[0]}</div>
                    <div class="cell"><a href="https://bscscan.com/address/${e.fromWallet}" target="_blank">${e.fromWallet.slice(0,6)}...${e.fromWallet.slice(-4)}</a></div>
                    <div class="cell">${(e.value / 100000000).toFixed(8)}</div>
                </div>`;
            }).join('');
            txs = `<div class="row head">
                <div class="cell">Tx</div>
                <div class="cell">Time</div>
                <div class="cell">From wallet</div>
                <div class="cell">Value (BNB)</div>
            </div>
            <div class="body">${tds}</div>`;
        }
        txs = `<div class="table">${txs}</div>`;
        
        modal.innerHTML = `<div id="content">
            <h2>API recharge history</h2>
            <p id="key-show">${key}</p>
            ${txs}
            <p id="missing">Missing tx? <a href="https://t.me/bscgas_info" target="_blank">contact us</a>!</p>
            <div id="button-container"><button id="close">Close</button></div>
        </div>`;
        
        modal.querySelector('#close').addEventListener('click', () => document.querySelector('#fog').remove());
    },

    showModal: function(tabSelected){
        const fog = document.createElement('div');
        fog.id = 'fog';
        fog.innerHTML = `<div id='api-window'>
            <div id='tab-container'>
                <div class="tab" id="info"><i class="fas fa-eye"></i><span class="text">Key Info</span></div>
                <div class="tab" id="edit"><i class="fas fa-edit"></i><span class="text">Edit Key</span></div>
                <div class="tab" id="create"><i class="fas fa-plus"></i><span class="text">Create Key</span></div>
                <div class="tab" id="close-tab"><i class="fas fa-times"></i></div>
            </div>
            <div id='content'></div>
        </div>`;

        const tabsContent = Object.fromEntries(['info', 'edit', 'create'].map(e => [e, (() => {
            const elem = document.createElement('div');
            elem.id = 'content';
            return elem;
        })()]));
        this.tabsContent = tabsContent;

        fog.querySelectorAll('.tab').forEach(e => e.addEventListener('click', () => {
            if (e.id == 'close-tab'){
                fog.click();
            }
            else{
                if (!e.classList.contains('active')){
                    fog.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
                    e.classList.add('active');
                }
                const content = fog.querySelector(`#content`);
                content.replaceWith(tabsContent[e.id]);
            }
        }));

        fog.addEventListener('click', () => fog.remove());
        fog.querySelector('div').addEventListener('click', e => e.stopPropagation());

        document.body.appendChild(fog);
        fadeIn(fog, 500);

        this.createNewApiContent();
        this.createEditApiContent();
        this.createInfoApiContent();

        const titleInfo = {
            origin: 'Informing an origin restrict the use of your API key to only the designated domain. It is highly recommended for preventing unauthorized calls using your key.',
            note: 'You could set a note to your key for informative purposes.',
        };

        Object.keys(tabsContent).forEach(tab => tabsContent[tab].querySelectorAll('.title i').forEach(e => {
            const inputClass = Array.from(e.parentNode.classList).filter(e => Object.keys(titleInfo).includes(e));
            new Tooltip(e, titleInfo[inputClass]);
        }));

        fog.querySelector(`#tab-container #${tabSelected || 'info'}`).click();
    },

    createKey: async function(body) {
        return await this.request('/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    },

    editKey: async function(key, body) {
        return await this.request(`/keys/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    },

    getKey: async function(key) {
        return await this.request(`/keys/${key}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
    },

    updateCredit: async function(key){
        return await this.request(`/credit/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
        });
    },

    getCredit: async function(key) {
        return await this.request(`/credit/${key}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
    },

    getLogs: async function(key, fromTime, toTime) {
        let options = {};
        if (fromTime){
            options.fromTime = fromTime;
        }
        if (toTime){
            options.toTime = toTime;
        }
        options = Object.keys(options).length == 0 ? '' : '?' + Object.entries(options).map(([key, value]) => `${key}=${value}`).join('&');

        return await this.request(`/logs/${key}${options}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
    },

    copyText: function(parent){
        const input = parent.querySelector('input');
        const oldText = input.value;
        input.value = `COPIED`;
        
        setTimeout(() => input.value = oldText, 500);

        navigator.clipboard.writeText(oldText);
    },

    request: async function(endpoint, options){
        try {
            const data = await (await fetch(endpoint, options)).json();

            if (data.error){
                console.log(data);
            }
            return data;
        }
        catch(error){
            console.log(error);
            return error;
        }
    }
};
document.querySelector('#manage-apikey').addEventListener('click', () => api.showModal());


const limits = {
    REQUEST_COST: document.querySelector('#requestcost').value,
    USAGE_LIMIT: document.querySelector('#usagelimit').value,
};
document.querySelectorAll('.request-limit').forEach(e => e.innerHTML = limits.USAGE_LIMIT);
document.querySelectorAll('.request-cost').forEach(e => e.innerHTML = limits.REQUEST_COST * 0.00000001 + ' BNB');
price.get().then(price => document.querySelector('#credit-bnb').innerHTML = `$${(price.now * limits.REQUEST_COST * 0.00000001).toFixed(7)}`);


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
                "ipHour": 0,
                "apiKeyTotal": 0,
                "ipTotal": 0
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
                "tx": "0x0000000000000000000000000000000000000000000000000000000000000000",
                "timestamp": "2000-00-00T00:00:00.000Z",
                "value": "0",
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
            this.history.update(await this.history.getData());
        }
        [this.keys, this.credit, this.logs].forEach(async item => item.update(await item.getData(key)));
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
    href: `/gas?apikey={{apikey}}&accept=35,60,90,100&blocks=200&version=2`,
});
new UrlBox(document.querySelector('#url-history.url'), {
    network: true,
    href: `/history?apikey={{apikey}}&from=0&to={{now}}&page=1&candles=1000&timeframe=30`,
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


// remove hidden inputs sent from server
document.querySelectorAll('.template-var').forEach(e => e.remove());


// build faq
const faq = [
    [`What is Owlracle?`,
    `Owlracle is an open-source gas price oracle running predictions for multiple blockchain networks. We provide a website and an API for retrieving Owlracle's information, giving dapp developers easy access to gas information.`],
    [`How do you make the gas price predictions?`,
    `This tool attempts to predict the gas price to be paid on multiple chains by averaging recent past transactions. For each block, we take the mined transaction with the lower gas price. Every speed is measured by calculating the minimum gas price paid to be accepted on a given percentage of past blocks. Take into consideration that the numbers shown are just estimations.`],
    [`Your website looks so much like <a href="https://bscgas.info" target="_blank">bscgas</a>. Is it a coincidence?`,
    `Not at all. We are the same team as bscgas. But as soon as we noticed the demand to expand to other networks, we created owlracle to be a gas price oracle hub on every major chain. We also developed our own oracle software, so we thought we should rebrand ourselves.`],
    [`How do you predict the gas price fee?`,
    `We scan the last N (default 200) blocks and check the minimum gas price accepted on a transaction for each block. Then we calculate how much gas you should pay to be accepted on X% (varying by speed) of these blocks.`],
    [`My app have thousands of user requesting bscgas service. The API limit seems too low.`,
    `You should never call our API from the frond-end. Schedule your server to retrieve information at time intervals of your choice, then when your users request it, just send the cached data to them.`],
    [`Shouldn't I be worried if users peek into my app's source-code and discover my API key?`,
    `Do not EVER expose your API key on the front-end. If you do so, users will be able to read your source-code then make calls using your API (thus expending all your credits). Retrieve our data from your server back-end, then provide the cached data to your users when they request it.`],
    [`My API key have been exposed. What should I do?`,
    `You can reset your API key hash and generate a new one <a id="link-reset-key">clicking here</a>.`],
    [`I want to make a recharge. Where can I find my API wallet?`,
    `Your API wallet can be found in the <a onclick="document.querySelector('#manage-apikey').click()">API management window</a>. To add credits to your account, just make a BNB transfer of any amount to your API wallet. Use the management window to update your balance and keep track of your recharge history.`],
];
document.querySelector('#faq').innerHTML = `<ul>${faq.map(e => `<li><ul><li class="question"><i class="fas fa-angle-right"></i>${e[0]}</li><li class="answer">${e[1]}</li></ul></li>`).join('')}</ul>`;
document.querySelectorAll('#faq .question').forEach(e => e.addEventListener('click', () => e.parentNode.classList.toggle('open')));

document.querySelector('#link-reset-key').addEventListener('click', () => api.showModal('edit'));


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