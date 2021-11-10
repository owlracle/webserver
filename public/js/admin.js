import { DynamicScript, theme, wallet, price, network, cookies, Modal, api } from './utils.js';

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

        const data = await api.request(`/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

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
    const data = await api.request(`/requests?timeframe=h`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    chart.init().then(() => {
        document.querySelector(`#timeframe-switcher #tf-h`).click();

        theme.onChange = () => {
            chart.setTheme(cookies.get('theme') || 'dark');
        };
        
        theme.set(cookies.get('theme') || 'dark');
    });
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
            const history = await this.getHistory(b.id.split('tf-')[1]);
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

    getHistory: async function(timeframe=60, page=1, candles=this.candles) {
        this.timeframe = timeframe;
        this.history = await api.request(`/requests?timeframe=${timeframe}`);
        // console.log(this.history)
        if (this.history.error){
            console.log(this.history);

            if (this.history.error.status == 401){
                return this.getHistory(timeframe, page, candles);
            }
            return [];
        }
        return this.history.results;
    },

    isReady: async function() {
        return this.ready || new Promise(resolve => setTimeout(() => resolve(this.isReady()), 10));
    }
};