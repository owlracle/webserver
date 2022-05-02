import { DynamicScript, theme, wallet, price, network, cookies, Modal, api, startHeaderApiSearch } from './utils.min.js';

startHeaderApiSearch();

new DynamicScript('https://kit.fontawesome.com/c1a16f97ec.js');

theme.load();
document.querySelector('#theme').addEventListener('click' , () => theme.toggle());


// place network button in header
const obj = document.querySelector('#network-btn');
obj.classList.add(network.get().symbol);
obj.querySelector('.name').innerHTML = network.get().name;
obj.querySelector('.icon').src = `img/${network.get().symbol}.png`;


// network button action
obj.addEventListener('click', function() {
    const dropdown = document.createElement('div');
    dropdown.id = 'dropdown';

    dropdown.innerHTML = Object.entries(network.getList()).map(([k,v]) => `<div id="${k}" class="item"><a href="/${k}"><img class="icon" src="img/${k}.png"><span class="name">${v.name}</span></a></div>`).join('');

    dropdown.style.top = `${this.offsetTop + this.clientHeight}px`;
    dropdown.style.left = `${this.offsetLeft + this.clientWidth - 130}px`;

    const fog = document.createElement('div');
    fog.id = 'fog';
    fog.classList.add('invisible');

    document.body.appendChild(fog);
    fog.appendChild(dropdown);

    fog.addEventListener('click', () => fog.remove());
});

document.querySelectorAll('.token-name').forEach(e => e.innerHTML = network.get().token);
document.querySelectorAll('.chain-symbol').forEach(e => e.innerHTML = network.get().symbol);
document.querySelectorAll('.chain-name').forEach(e => e.innerHTML = network.get().name);

// set the right token to price fetch according to the network
price.token = network.get().token;
price.update();
setInterval(() => price.update(), 10000); // update every 10s

// set network block explorer in footer
const explorer = document.querySelector('footer .resources #explorer');
explorer.href = network.get().explorer.href;
explorer.querySelector('img').src = network.get().explorer.icon;
explorer.querySelector('.name').innerHTML = network.get().explorer.name;

// set donation wallet modal
wallet.loadImg(document.querySelector('#donate'), network.get());
document.querySelectorAll('.donate-link').forEach(e => wallet.bindModal(e, network.get()));


// add menu button
const menuButton = document.querySelectorAll('header .col')[0];
menuButton.insertAdjacentHTML('afterbegin', `<div id="menu-button"><i class="fa-solid fa-bars"></i></div>`);
menuButton.addEventListener('click', () => {
    document.querySelector('#fog.menu.hidden').classList.remove('hidden');
});
const fogMenu = document.querySelector('#fog.menu');
fogMenu.addEventListener('click', () => fogMenu.classList.add('hidden'));


const session = {
    get: function() {
        return cookies.get('session');
    },

    set: function(id) {
        cookies.set('session', id, { expires: { hours: 1 } });
    },

    delete: function() {
        cookies.delete('session');
    },

    validate: async function(password) {
        let body = { password: password }
        if (!password){
            body = { currentSession: this.get() };

            if (!this.get()){
                return false;
            }    
        }

        const data = await api.request(`/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        // console.log(data)

        // fail. remove cookie session and reload window
        if (data.error){
            this.delete();
            return data;
        }

        // success, refresh cookie session be happy
        this.set(data.sessionId);
        return data;
    },

    login: async function() {
        const buttonPress = async modal => {
            const value = modal.domObject.querySelector('input').value.trim();

            if (value.length > 0){
                const button = modal.domObject.querySelector('button');
                button.innerHTML = `<i class="fas fa-spin fa-cog"></i>`;
                button.setAttribute('disabled', true);
                modal.domObject.querySelector('input').setAttribute('disabled', true);
                
                // request a new session from backend if passowrd is correct
                const data = await this.validate(value);
                
                // fail. reload window to ask again
                if (data.error){
                    new Modal(`<h2>${data.error}</h2>
                        <p>${data.message}</p>
                        <div id="button-container"><button id="close">OK</button></div>`, { fog: { dark: true } }
                    ).addEvent({ tag: 'button', event: 'click', callback: () => this.login() });
                    return;
                }
                // success, set cookie session and reload window
                else {
                    this.set(data.sessionId);
                    modal.close();
                    this.loaded = true;
                }
            }
        }
    
        // not logged, ask for password
        const modal = new Modal(`<h2>Admin Login</h2>
            <div class="input-container">
                <input class="input-text" type="password">
                <button class="input-button"><i class="fas fa-sign-in-alt"></i></button>
            </div>
        `, {
            id: 'admin-login',
            fog: {
                close: false,
                dark: true
            },
        });
        // call button press
        modal.addEvent({ tag: 'button', event: 'click', callback: () => buttonPress(modal) })
        modal.addEvent({ class: 'input-text', event: 'keyup', callback: e => {
            if (e.key == 'Enter') {
                buttonPress(modal)
            }
        }});
    },

    check: async function() {
        // check if admin is logged in
        const data = await this.validate();

        // fail. remove cookie session and reload window
        if (!data || data.error){
            this.delete();
            this.login();

            // wait for login to be resolved
            return await new Promise(resolve => {
                const monitor = () => {
                    if (this.loaded){
                        resolve(true);
                    }
                    else{
                        setTimeout(() => monitor(), 100);
                    }
                }
                monitor();
            });
        }
        // success, refresh cookie session be happy
        else {
            this.set(data.sessionId);
            return true;
        }
    }
};

session.check().then(async () => {
    await chart.init();
    document.querySelector(`#timeframe-switcher #tf-h`).click();

    theme.onChange = () => {
        chart.setTheme(cookies.get('theme') || 'dark');
    };
    
    theme.set(cookies.get('theme') || 'dark');
});


const chart = {
    package: import('https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js'),
    ready: false,
    timeframe: 60,
    page: 1,
    candles: 1000,
    lastCandle: (new Date().getTime() / 1000).toFixed(0),
    allRead: false,
    network: network.get().symbol,

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
    
        this.series;

        
        // switch time frames
        document.querySelectorAll('#timeframe-switcher button').forEach(b => b.addEventListener('click', async () => {
            document.querySelectorAll('#timeframe-switcher button').forEach(e => e.classList.remove('active'));
            const text = b.innerHTML;
            b.innerHTML = `<i class="fas fa-spin fa-cog"></i>`;
            const tf = b.id.split('tf-')[1];
            const ntw = Array.from(document.querySelectorAll('#network-switcher button')).filter(e => e.classList.contains('active'))[0].id.split('ntw-')[1];
            const history = await this.getHistory({ timeframe: tf, network: ntw });
            b.classList.add('active');
            b.innerHTML = text;
            this.update(history);
        }));

        // switch networks
        document.querySelectorAll('#network-switcher button').forEach(b => b.addEventListener('click', async () => {
            document.querySelectorAll('#network-switcher button').forEach(e => e.classList.remove('active'));
            const text = b.innerHTML;
            b.innerHTML = `<i class="fas fa-spin fa-cog"></i>`;
            const tf = Array.from(document.querySelectorAll('#timeframe-switcher button')).filter(e => e.classList.contains('active'))[0].id.split('tf-')[1];
            const ntw = b.id.split('ntw-')[1];
            const history = await this.getHistory({ timeframe: tf, network: ntw });
            b.classList.add('active');
            b.innerHTML = text;
            this.update(history);
        }));

        this.timeScale = this.obj.timeScale();
    
        this.timeScale.subscribeVisibleLogicalRangeChange(async () => {
            const logicalRange = this.timeScale.getVisibleLogicalRange();
            if (logicalRange !== null && logicalRange.from < 0 && this.history.length >= this.candles && !this.scrolling && !this.allRead) {
                this.scrolling = true;
                const oldHistory = this.history;
                const newHistory = await this.getHistory({ timeframe: this.timeframe, page: this.page + 1, network: ntw});
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
            const speedData = data.map(e => { return { 
                time: parseInt(new Date(e.timestamp).getTime() / 1000),
                value: e.requests,
            }}).reverse();
    
            if (!this.series){
                this.series = this.obj.addLineSeries();
            }
            this.series.setData(speedData);
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

    getHistory: async function ({ timeframe = 60, page = 1, candles = this.candles, network }) {
        network = network && network != 'all' ? `&network=${network}` : '';
        this.timeframe = timeframe;
        this.history = await api.request(`/admin/requests?timeframe=${timeframe}&currentSession=${session.get()}${network}`);
        // console.log(this.history)
        if (this.history.error){
            console.log(this.history);

            new Modal(`<h2>${this.history.error}</h2>
                <p>${this.history.message}</p>
                <div id="button-container"><button id="close">OK</button></div>`, { fog: { dark: true } }
            ).addEvent({ tag: 'button', event: 'click', callback: () => session.login() });


            if (this.history.error.status == 401){
                return this.getHistory({ timeframe: timeframe, page: page, candles: candles, network: network });
            }
            return [];
        }
        return this.history.results;
    },

    isReady: async function() {
        return this.ready || new Promise(resolve => setTimeout(() => resolve(this.isReady()), 10));
    }
};


// set menu click action
document.querySelectorAll('#side-menu .item').forEach((e,i) => e.addEventListener('click', () => {
    const content = document.querySelectorAll('#content .menu-content');
    content.forEach(e => e.classList.remove('active'));
    content[i].classList.add('active');

    e.parentNode.querySelectorAll('.item').forEach(e => e.classList.remove('active'));
    e.classList.add('active');
}));
document.querySelector('#side-menu #requests').click();


const creditTable = {
    input: document.querySelector('#content #key input'),
    checkBtn: document.querySelector('#content #key #check'),
    table: document.querySelector('#content #key #wallet-table'),
    pageLeft: document.querySelector('#content #key #page-container #left'),
    pageRight: document.querySelector('#content #key #page-container #right'),

    data: {
        input: '',
        order: 'desc',
        field: 'usage',
        page: 0,
    },

    init: function() {
        // input change
        this.input.addEventListener('input', () => {
            if (this.input.value.length > 0){
                let sliced = this.input.value;
                if (this.input.value.length >= 11){
                    sliced = (this.input.value.slice(0,6) + '...' + this.input.value.slice(-4)).toLowerCase();
                }
                this.checkBtn.innerHTML = `Check ${sliced}`;
            }
            else {
                this.checkBtn.innerHTML = `Check all`;
            }

            this.data.input = this.input.value;
        });

        // check api keys by wallet
        this.checkBtn.addEventListener('click', async () => {
            if (this.checkBtn.hasAttribute('disabled')){
                return;
            }

            this.checkBtn.setAttribute('disabled', true);
            this.checkBtn.innerHTML = `<i class="fas fa-spin fa-cog"></i>`;
            this.table.innerHTML = `<div><i class="fas fa-spin fa-cog"></i></div>`;

            const data = await this.check();

            if (data.error){
                console.log(data);
                return;
            }

            this.checkBtn.removeAttribute('disabled');
            this.checkBtn.innerHTML = `Check`;
        });
    },

    check: async function() {
        const value = this.data.input;

        let query = {};
        query.order = this.data.order;
        query.field = this.data.field;
        query.page = this.data.page;

        if (value.length){
            query.id = value;
        }

        query = new URLSearchParams(query).toString();
        const data = await api.request(`/admin/credit${ query.length ? `?${query}` : '' }`);

        let tableHTML = `
            <div class="cell head">Id</div>
            <div class="cell head">Origin</div>
            <div class="cell head">Note</div>
            <div class="cell head">Credit <span id="credit" class="sort"><i class="fas fa-sort"></i></span></div>
            <div class="cell head">Usage 1D<span id="usage" class="sort"><i class="fas fa-sort"></i></span></div>
            <div class="cell head">Time Checked <span id="time" class="sort"><i class="fas fa-sort"></i></span></div>
        `;
        tableHTML += data.results.map(e => `
            <div class="cell">${e.id}</div>
            <div class="cell text">${e.origin}</div>
            <div class="cell text">${e.note}</div>
            <div class="cell">${e.credit}</div>
            <div class="cell">${e.key_use}</div>
            <div class="cell">${e.timeChecked}</div>
        `).join('');

        this.table.innerHTML = tableHTML;

        this.table.querySelectorAll('.head .sort').forEach(e => e.addEventListener('click', async () => {
            // change order only if did not change field
            if (this.data.field == e.id){
                this.data.order = this.data.order == 'desc' ? 'asc' : 'desc';
            }
            this.data.field = e.id;

            const text = e.innerHTML;
            e.innerHTML = `<div><i class="fas fa-spin fa-cog"></i></div>`;
            await this.check();
            e.innerHTML = text;

        }));

        return data;
    },
};
creditTable.init();
