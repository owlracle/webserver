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


// set the cookie utils object
const cookies = {
    set: function (key, value, { expires, path, json } = {}) {
        let expTime = 0;
        if (expires) {
            if (typeof expires === "object") {
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
        }
        if (!path) {
            path = '/';
        }
        if (json){
            value = JSON.stringify(value);
        }

        expTime = expTime > 0 ? `;expires=${new Date(expTime).toUTCString()}` : '';
        const cookieString = `${key}=${value}${expTime};path=${path}`;
        document.cookie = cookieString;
        return cookieString;
    },

    get: function (key, json) {
        const cookies = document.cookie.split(';').map(e => e.trim());
        const match = cookies.filter(e => e.split('=')[0] == key);
        let value = match.length ? match[0].split('=')[1] : false;

        if (value && json){
            value = JSON.parse(value);
        }

        return value;
    },

    delete: function (key) {
        const cookies = document.cookie.split(';').map(e => e.trim());
        const match = cookies.filter(e => e.split('=')[0] == key);

        document.cookie = `${key}=0;expires=${new Date().toUTCString()}`;
        return match.length > 0;
    },

    refresh: function (key, { expires, path } = {}) {
        if (this.get(key)){
            const optArgs = { path: '/' };

            if (expires) {
                optArgs.expires = expires;
            }
            if (path) {
                optArgs.path = path;
            }

            return this.set(key, this.get(key), optArgs);
        }
        return false;
    },
};


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

            if (oldName != name){
                // already loaded, reload
                if (typeof tsParticles !== 'undefined' && this.particles){
                    tsParticles.loadJSON('frame', `config/particles-${name}.json`)
                }
            }

            if (this.onChange){
                this.onChange();
            }    
        }
    },

    load: function() {
        this.set(cookies.get('theme') || this.choice);

        this.particles = cookies.get('particles') == 'false' ? false : true;
        if (this.particles && window.outerWidth < 600){
            this.particles = false;
        }

        cookies.set('particles', this.particles, { expires: { days: 365 } });
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
    },
};


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
            <div id="qr"><img src="${this.img.src}" alt="qr code"></div>
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

// fetch token price from coingecko and update the pages's ticker
const price = {
    current: 0,
    element: document.querySelector('#price'),
    token: 'ETH',

    get: async function() {
        const data = await (await fetch(`/tokenprice/${this.token}`)).json();
        const [ price, price24h ] = [ data.price, data.change24h ];
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


// set the corresponding network in header
const network = {
    list: {
        eth: { symbol: 'eth', name: 'Ethereum', token: 'ETH', id: 1, explorer: {
            icon: 'https://etherscan.io/images/favicon3.ico', href: 'https://etherscan.io', name: 'Etherscan', apiAvailable: true,
        }, rpc: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',  },
        bsc: { symbol: 'bsc', name: 'BSC', longName: 'BNB Chain', token: 'BNB', id: 56, explorer: {
            icon: 'https://bscscan.com/images/favicon.ico', href: 'https://bscscan.com', name: 'BscScan', apiAvailable: true,
        }, rpc: 'https://bsc-dataseed.binance.org/',  },
        avax: { symbol: 'avax', name: 'Avalanche', token: 'AVAX', id: 43114, explorer: {
            icon: 'https://snowtrace.io/images/favicon.ico', href: 'https://snowtrace.io', name: 'SnowTrace', apiAvailable: true,
        }, rpc: 'https://api.avax.network/ext/bc/C/rpc',  },
        ftm: { symbol: 'ftm', name: 'Fantom', token: 'FTM', id: 250, explorer: {
            icon: 'https://ftmscan.com/images/favicon.png', href: 'https://ftmscan.com', name: 'FtmScan', apiAvailable: true,
        }, rpc: 'https://rpc.ftm.tools/',  },
        poly: { symbol: 'poly', name: 'Polygon', token: 'MATIC', id: 137, explorer: {
            icon: 'https://polygonscan.com/images/favicon.ico', href: 'https://polygonscan.com', name: 'PolygonScan', apiAvailable: true,
        }, rpc: 'https://polygon-rpc.com',  },
        cro: { symbol: 'cro', name: 'Cronos', token: 'CRO', id: 25, explorer: {
            icon: 'https://cronoscan.com/images/favicon.ico', href: 'https://cronoscan.com/', name: 'Cronoscan', apiAvailable: true,
        }, rpc: 'https://evm-cronos.crypto.org',  },
        one: { symbol: 'one', name: 'Harmony', longName: 'Harmony One', token: 'ONE', id: 166660000, explorer: {
            icon: 'https://explorer.harmony.one/favicon.ico', href: 'https://explorer.harmony.one', name: 'Harmony Explorer', apiAvailable: false,
        }, rpc: 'https://api.s0.t.hmny.io/',  },
        celo: { symbol: 'celo', name: 'Celo', token: 'CELO', id: 42220, explorer: {
            icon: 'https://avatars.githubusercontent.com/u/37552875?s=200&v=4', href: 'https://explorer.celo.org', name: 'Celo Explorer', apiAvailable: false,
        }, rpc: 'https://forno.celo.org',  },
        ht: { symbol: 'ht', name: 'Heco', token: 'HT', id: 128, explorer: {
            icon: 'https://hecoinfo.com/favicon.ico', href: 'https://hecoinfo.com', name: 'HecoInfo', apiAvailable: false,
        }, rpc: 'https://http-mainnet.hecochain.com',  },
        movr: { symbol: 'movr', name: 'Moonriver', token: 'MOVR', id: 1285, explorer: {
            icon: 'https://moonriver.moonscan.io/images/favicon.ico', href: 'https://moonriver.moonscan.io/', name: 'MoonScan', apiAvailable: true,
        }, rpc: 'https://rpc.moonriver.moonbeam.network',  },
        fuse: { symbol: 'fuse', name: 'Fuse', token: 'FUSE', id: 122, explorer: {
            icon: 'https://explorer.fuse.io/images/favicon-543fd97558f89019d8ee94144a7e46c7.ico?vsn=d', href: 'https://explorer.fuse.io/', name: 'Fuse Explorer', apiAvailable: false,
        }, rpc: 'https://rpc.fuse.io',  },
    },
    
    get: function(name) {
        if (!name){
            name = cookies.get('network') || 'eth';
        }

        return this.list[name];
    },

    getById: function(id) {
        return Object.values(this.list).find(e => e.id == id);
    },

    set: function(name){
        cookies.set('network', name, { expires: { days: 365 } });
    },

    getList: function() {
        return this.list;
    }
}


const api = {
    regex: {
        url: new RegExp(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9._-]{1,256}\.[a-z0-9]{1,10})\b.*$/),
        apiKey: new RegExp(/^[a-f0-9]{32}$/),
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

    showProfile: function(tabSelected){
        const fog = document.createElement('div');
        fog.id = 'fog';

        const container = document.createElement('div');
        container.innerHTML = `<div id='api-window' class="modal profile">
            <div id='tab-container'>
                <div class="tab" id="create"><i class="fas fa-square-plus"></i><span class="text">New API Key</span></div>
                <div class="tab disabled" id="info"><i class="fas fa-key"></i><span class="text">Key Info</span></div>
                <div class="tab disabled" id="recharge"><i class="fa-solid fa-bolt"></i><span class="text">Recharge Key</span></div>
                <div class="tab disabled" id="history"><i class="fa-solid fa-file-invoice-dollar"></i></i><span class="text">My recharges</span></div>
                <div class="tab disabled" id="logs"><i class="fa-solid fa-file-lines"></i><span class="text">Usage logs</span></div>
                <div class="tab disabled" id="logout"><i class="fa-solid fa-right-from-bracket"></i><span class="text">Logout</span></div>
            </div>
            <div id="content" class="empty"><i class="fa-solid fa-gear fa-spin"></i></div>
        </div>`;

        if (this.isLogged()) {
            container.querySelectorAll('.tab.disabled').forEach(e => e.classList.remove('disabled'));
        }

        container.querySelectorAll('.tab').forEach(e => e.addEventListener('click', async () => {
            if (e.classList.contains('disabled')) {
                fog.remove();
                await profile.loginModal(tabSelected);
                return;
            }

            profile.show(e.id)
        }));

        profile.window = container.querySelector('div');

        fog.appendChild(profile.window);
        fog.addEventListener('click', () => fog.remove());
        fog.querySelector('div').addEventListener('click', e => e.stopPropagation());

        document.body.appendChild(fog);
        fadeIn(fog, 500);
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

    updateCredit: async function({ apiKey, transactionHash=false }){
        return await this.request(`/credit/${apiKey}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionHash: transactionHash,
                network: network.get().symbol
            }),
        });
    },

    getCredit: async function(key) {
        return await this.request(`/credit/${key}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
    },

    getLogs: async function(key, fromTime, toTime) {
        const options = {};
        if (fromTime){
            options.fromtime = fromTime;
        }
        if (toTime){
            options.totime = toTime;
        }

        return await this.request(`/logs/${key}?${ new URLSearchParams(options).toString() }`, {
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

    // generic requests method
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
    },

    // login with an api key.
    login: async function() {
        const glyph = document.querySelector('#search #api-info i');
        glyph.classList.remove('fa-right-to-bracket', 'fa-key');
        glyph.classList.add('fa-spin', 'fa-cog');
    
        const input = document.querySelector('#search input');
        input.setAttribute('readonly', true);
    
        const key = api.isLogged() || input.value.trim().toLowerCase();
        let keyInfo = false;
        if (key.match(api.regex.apiKey)){
            keyInfo = await api.getKey(key);
            if (keyInfo.apiKey) {
                cookies.set('apikey-login', keyInfo.apiKey, { expires: { days: 30 } });
                glyph.classList.add('fa-key');

                document.querySelector('#search').classList.add('logged');
                input.value = `${key.slice(0,7)}...${key.slice(-7)}`;
            }
        }

        glyph.classList.remove('fa-spin', 'fa-cog');    
        if (!keyInfo) {
            glyph.classList.add('fa-right-to-bracket');
            input.removeAttribute('readonly');
            input.value = '';
        }

        return keyInfo;
    },

    // logout from api key
    logout: function() {
        if (api.isLogged()) {
            cookies.delete('apikey-login');
    
            document.querySelector('#search').classList.remove('logged');
            const input = document.querySelector('#search input');
            input.value = ``;
            input.removeAttribute('readonly');

            const glyph = document.querySelector('#search #api-info i');
            glyph.classList.remove('fa-key');
            glyph.classList.add('fa-right-to-bracket');

            new Toast('👋 You have logged out', { timeOut: 5000 });
        }
    },

    isLogged: function() {
        return cookies.get('apikey-login') || false;
    },
};


const profile = {
    content: {},

    loginModal: async function(redirect) {
        const fog = document.createElement('div');
        fog.id = 'fog';

        // get api key information
        const content = document.createElement('div');

        fog.innerHTML = `<div class="modal"><div id="content">
            <h2>API key Login</h2>
            <p class="title">API key</p>
            <input type="text" class="input-text keys" id="key" placeholder="00000000000000000000000000000000">
            <span id="key-tip" class="tip"></span>
            <div id="button-container"><button id="get-key">Search</button></div>
        </div></div>`;

        // remove tip for invalid key
        fog.querySelector('#key').addEventListener('keyup', function() {
            const value = this.value.trim().toLowerCase();
            if (value.match(apiKeyRegex)){
                const tip = fog.querySelector(`#key-tip`);
                tip.innerHTML = '';
                this.classList.remove('red');
            }
        });

        const apiKeyRegex = api.regex.apiKey;

        fog.querySelector('#get-key').addEventListener('click', async function() {
            let error = false;

            const key = fog.querySelector('#key').value.trim().toLowerCase();
            if (!key.match(apiKeyRegex)){
                const tip = fog.querySelector('#key-tip');
                tip.innerHTML = 'Invalid API key';
                fog.querySelector('#key').classList.add('red');
                error = true;
            }

            if (!error){
                this.setAttribute('disabled', true);
                this.innerHTML = '<i class="fas fa-spin fa-cog"></i>';

                const data = await api.getKey(key);

                fog.remove();
                document.querySelector('#search input').value = data.apiKey;
                await api.login();
                api.showProfile(redirect);
            }
        });

        fog.addEventListener('click', () => fog.remove());
        fog.querySelector('div').addEventListener('click', e => e.stopPropagation());

        document.body.appendChild(fog);
        fadeIn(fog, 500);
    },

    show: async function(id) { 
        const elem = document.querySelector(`#fog #${id}.tab`);
        if (!profile.locked && !elem.classList.contains('disabled')){
            this.locked = true;
    
            document.querySelectorAll('#fog .tab').forEach(e => e.classList.remove('active'));
            elem.classList.add('active');
    
            if (!this.content[id]){
                // put placeholder container
                this.content[id] = document.createElement('div');
                this.content[id].id = 'content';
                this.content[id].classList.add('empty');
                this.content[id].innerHTML = '<i class="fa-solid fa-gear fa-spin"></i>';
            }
            this.window.querySelector('#content').replaceWith(this.content[id]);
            
            await this.createContent(id);
            this.bindContent(id);
    
            this.window.querySelector('#content').replaceWith(this.content[id]);
    
            this.locked = false;
        }
    },

    createContent: async function(id) {
        const contentFunctions = {
            info: async () => {
                const data = await api.getKey(api.isLogged());
                console.log(data);

                if (!data.apiKey){
                    new Toast(`☹️ ${ data.error }: ${ data.message }`)
                    return '';
                }

                // build fields
                return `<h2>API key information</h2><div id="content-container">
                    <p class="label">API Key</p>
                    <div class="input-container">
                        <input type="text" class="input-text keys" id="input-apiKey" readonly value="${ data.apiKey }">
                        <div id="reset-key" class="input-button" title="Reset key"><i class="fas fa-sync-alt"></i></div>
                    </div>
                    
                    <p class="label">Creation</p>
                    <div class="input-container">
                        <input type="text" class="input-text keys" id="input-creation" readonly value="${ new Date(data.creation).toISOString().replace('T', ' ').split('.')[0] }">
                    </div>
    
                    <p class="label">Credit</p>
                    <div class="input-container">
                        <input type="text" class="input-text keys" id="input-credit" readonly value="$${ parseFloat(data.credit).toFixed(6) }">
                        <div id="recharge-key" class="input-button" title="Recharge key"><i class="fa-solid fa-bolt"></i></div>
                    </div>
    
                    <p class="label">Origin</p>
                    <div class="input-container">
                        <input type="text" class="input-text keys" id="input-origin" readonly value="${ data.origin || '' }">
                        <div id="edit-origin" class="input-button" title="Edit"><i class="fa-solid fa-pen-to-square"></i></div>
                    </div>
    
                    <p class="label">Note</p>
                    <div class="input-container">
                        <input type="text" class="input-text keys" id="input-note" readonly value="${ data.note || '' }">
                        <div id="edit-note" class="input-button" title="Edit"><i class="fa-solid fa-pen-to-square"></i></div>
                    </div>
                </div>`;
            },

            create: async () => {
                return `<h2>New API key</h2>
                    <p class="label origin">Origin</p>
                    <input type="text" class="input-text" id="origin" placeholder="mywebsite.com">
                    <span id="origin-tip" class="tip"></span>
                    <p class="label note">Note</p>
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
                    <div id="button-container"><button id="create-key" disabled>Create API key</button></div>
                `;
            },

            recharge: async () => {
                return this.content[id].querySelector('.fa-gear') ?
                    `<h2>API key credit recharge</h2>
                    <p>Connect your wallet to recharge your API key</p>
                    <div id="button-container" class="vertical"></div>` :
                    this.content[id].innerHTML;
            },

            history: async () => {
                const modal = document.querySelector('#fog #api-window');
                modal.classList.add('large');

                const key = api.isLogged();
                const data = await api.getCredit(key);

                let txs = `<div class="empty">No transactions found. Try recharging your API key.</div>`;
                if (data.results.length > 0){            
                    const tds = data.results.map(e => {
                        const thisNetwork = network.getList()[e.network];
        
                        return `<div class="row col-6">
                            <div class="cell"><a href="${thisNetwork.explorer.href}/tx/${e.tx}" target="_blank" rel="noopener nofollow">${e.tx.slice(0,6)}...${e.tx.slice(-4)}</a></div>
                            <div class="cell">${new Date(e.timestamp).toISOString().replace('T', ' ').split('.')[0]}</div>
                            <div class="cell">${thisNetwork.name}</div>
                            <div class="cell"><a href="${thisNetwork.explorer.href}/address/${e.fromWallet}" target="_blank" rel="noopener nofollow">${e.fromWallet.slice(0,6)}...${e.fromWallet.slice(-4)}</a></div>
                            <div class="cell">${parseFloat(e.price).toFixed(4)}</div>
                            <div class="cell">${(parseInt(e.value) * 0.000000001).toFixed(6)}</div>
                        </div>`;
                    }).join('');
                    txs = `<div class="row head col-6">
                        <div class="cell">Tx</div>
                        <div class="cell">Time</div>
                        <div class="cell">Network</div>
                        <div class="cell">From wallet</div>
                        <div class="cell">Token Price</div>
                        <div class="cell">Value</div>
                    </div>
                    <div class="body">${tds}</div>`;
                }
                txs = `<div class="table">${txs}</div>`;
                
                return `<h2>API recharge history</h2>
                    <p id="key-show">${key}</p>
                    ${txs}
                    <p id="missing">Missing tx? <a href="https://t.me/owlracle" target="_blank" rel="noopener">contact us</a>!</p>
                `;
            },

            logs: async () => {
                const key = api.isLogged();
        
                const txs = `<div class="table"><div class="empty">No requests found. Try to adjust the time range of your search.</div></div>`;
        
                if (!this.fromTime) {
                    this.fromTime = parseInt(new Date(new Date().getTime() - 3600000).getTime() / 1000);
                }
                if (!this.toTime) {
                    this.toTime = parseInt(new Date().getTime() / 1000);
                }

                const now = new Date(this.toTime * 1000).toISOString().slice(0,16);
                const ago = new Date(this.fromTime * 1000).toISOString().slice(0,16);
        
                const modal = document.querySelector('#fog #api-window');
                modal.classList.add('large');

                let previousTable = this.content[id].querySelector('#table-container');
                if (previousTable) {
                    previousTable = previousTable.innerHTML;
                }

                return `<div class="title">
                    <div class="col">
                        <h2>API request history</h2>
                        <p id="key-show">${key}</p>
                    </div>                
                    <div class="col right">
                        <label>
                            <span>From:</span>
                            <input id="from-time" type="datetime-local" class="input-text time-range" value="${ ago }">
                        </label>
                        <label>
                            <span>To:</span>
                            <input id="to-time" type="datetime-local" class="input-text time-range" value="${ now }">
                        </label>
                    </div>    
                </div>
                <div id="table-container">${previousTable || txs}</div>`;
            }
        };

        const modal = document.querySelector('#fog #api-window')
        modal.classList.remove('large');

        const container = document.createElement('div');
        container.id = 'content';
        container.innerHTML = contentFunctions[id] ? await contentFunctions[id]() : '';

        this.content[id] = container;
        return container;
    },

    bindContent: function(id) {
        const bindFunctions = {
            info: () => {
                const content = this.content[id];

                content.querySelector('#recharge-key').addEventListener('click', () => {
                    profile.show('recharge');
                });

                const editOrigin = content.querySelector('#edit-origin');
                const input = content.querySelector('#input-origin');
                const glyph = editOrigin.querySelector('i');

                editOrigin.addEventListener('click', () => {
                    if (editOrigin.classList.contains('green')) {
                        glyph.classList.add('fa-pen-to-square');
                        glyph.classList.remove('fa-check');
                        editOrigin.classList.remove('green');

                        console.log(input.value);
                    }
                    else {
                        glyph.classList.remove('fa-pen-to-square');
                        glyph.classList.add('fa-check');
                        editOrigin.classList.add('green');
                        input.removeAttribute('readonly');
                        input.focus();
                    }

                });
            },

            create: () => {
                const content = this.content[id];
                content.querySelectorAll('#checkbox-container input').forEach(e => e.addEventListener('click', () => {
                    const checkboxes = content.querySelectorAll('#checkbox-container input');
                    if (checkboxes[0].checked && checkboxes[1].checked){
                        content.querySelector('#create-key').removeAttribute('disabled');
                    }
                    else {
                        content.querySelector('#create-key').setAttribute('disabled', true);
                    }
                }));

                const urlRegex = api.regex.url;
                content.querySelector('#origin').addEventListener('keyup', () => {
                    const value = content.querySelector('#origin').value.trim().toLowerCase();
                    const match = value.match(urlRegex);
                    if (match && match.length > 1){
                        const tip = content.querySelector('#origin-tip');
                        tip.innerHTML = '';
                        content.querySelector('#origin').classList.remove('red');
                    }
                });

                content.querySelector('#create-key').addEventListener('click', async function() {
                    const body = {};
                    let error = false;
                    if (content.querySelector('#origin').value.length){
                        // make sure origin informed is only then domain name
                        const value = content.querySelector('#origin').value.trim().toLowerCase();
                        const match = value.match(urlRegex);
                        if (match && match.length > 1){
                            body.origin = value;
                        }
                        else{
                            const tip = content.querySelector('#origin-tip');
                            tip.innerHTML = 'Invalid domain';
                            content.querySelector('#origin').classList.add('red');
                            error = true;
                        }
                    }
                    if (content.querySelector('#note').value.length){
                        body.note = content.querySelector('#note').value.trim();
                    }

                    if (!error){
                        this.setAttribute('disabled', true);
                        this.innerHTML = '<i class="fa-solid fa-gear fa-spin"></i>';
            
                        body.grc = await recaptcha.getToken();
                        const data = await api.createKey(body);
                        api.showWindowCreate(data);
                    }
                });
            },

            recharge: () => {
                const content = this.content[id];

                let updatingUI = false;
   
                const checkWalletConnection = async () => {
                    if (updatingUI) {
                        return;
                    }

                    updatingUI = true;

                    // not injected
                    if (!this.web3 || !this.web3.injected){
                        content.innerHTML = `<h2>API key credit recharge</h2>
                        <p>You must get Metamask to connect to your wallet</p>
                        <div id="button-container" class="vertical"><button>Get Metamask</button></div>`;

                        const button = content.querySelector('button');
                        button.addEventListener('click', () => {
                            window.open('https://metamask.io/');
                            document.querySelector('#fog').click();
                        })
                        updatingUI = false;
                        return;
                    }

                    // not connected
                    if (!this.web3.connected) {
                        content.innerHTML = `<h2>API key credit recharge</h2>
                        <p>Connect your wallet to recharge your API key</p>
                        <div id="button-container" class="vertical"><button>Connect</button></div>`;

                        const button = content.querySelector('button');
                        button.addEventListener('click', async () => {
                            await this.web3.connect();
                        });

                        updatingUI = false;
                        return;
                    }

                    // unsupported network
                    const connectedNetwork = network.getById(await this.web3.getNetworkId());
                    if (!connectedNetwork) {
                        content.innerHTML = `<h2>API key credit recharge</h2>
                        <p>Network not supported</p>
                        <div id="button-container" class="vertical"><button><img src="img/${ network.get().symbol }.png">Switch to ${ network.get().name } network</button></div>`;

                        const button = content.querySelector('button');
                        button.addEventListener('click', async () => {
                            await this.web3.switchNetwork(network.get());
                        });

                        updatingUI = false;
                        return;
                    }

                    // wrong network
                    if (connectedNetwork.id != network.get().id) {
                        content.innerHTML = `<h2>API key credit recharge</h2>
                        <p>Wrong network</p>
                        <div id="button-container" class="vertical">
                            <button id="switch"><img src="img/${ network.get().symbol }.png">Switch to ${ network.get().name } network</button>
                            <a href="/${ connectedNetwork.symbol }"><button><img src="img/${ connectedNetwork.symbol }.png">Go to ${ connectedNetwork.name } app</button></a>
                        </div>`;

                        const button = content.querySelector('#switch');
                        button.addEventListener('click', async () => {
                            await this.web3.switchNetwork(network.get());
                        });

                        updatingUI = false;
                        return;
                    }

                    // ok
                    const account = await this.web3.getAccount();
                    const accountSliced = `${ account.slice(0,6) }...${ account.slice(-4) }`;

                    content.innerHTML = `<h2>API key credit recharge</h2>
                    <p class="title">Connected Wallet</p>
                    <div class="input-container">
                        <input type="text" class="input-text keys" id="wallet" readonly value="${ accountSliced }">
                        <div class="input-button">
                            <span id="network-icon"><img src='img/${ network.get().symbol }.png'></span>
                        </div>
                    </div>
                    <p class="title">API key</p>
                    <input type="text" class="input-text keys" id="key" readonly value="${ api.isLogged() }">
                    <p class="title">Recharge amount</p>
                    <div class="input-container">
                        <input type="text" class="input-text keys" id="amount" placeholder="0.0000">
                        <div id="token" class="input-button">
                            <span class="token-name">${ network.get().token }</span>
                        </div>
                    </div>
                    <p class="title" id="values">
                        <span id="usd">~$0.00</span>
                        <span>Balance: <span id="balance">0.0000</span><span class="token-name">${ network.get().token }</span></span>
                    </p>
                    <div id="gasprice">
                        <div id="title">
                            <img src="https://owlracle.info/img/owl.webp" alt="owlracle logo">
                            <psna>Recommended Gas Price</span>
                        </div>
                        <div id="body">
                            <div class="spin"><i class="fas fa-spin fa-cog"></i></div>
                            <span>Let me handle this </span>
                        </div>
                    </div>
                    <div id="button-container"><button id="recharge-key" disabled>⚡Recharge⚡</button></div>`;

                    const key = content.querySelector('#key');
                    const apiKeyRegex = api.regex.apiKey;
                    const button = content.querySelector('button');
                    const amount = content.querySelector('#amount');

                    // refresh TOKEN balance automatically
                    const refreshBalance = async (loop=true) => {
                        const balanceDOM = content.querySelector('#values #balance');
                        if (balanceDOM) {
                            balanceDOM.innerHTML = (await this.web3.getBalance()).slice(0,9);
                            if (loop) {
                                setTimeout(() => refreshBalance(), 5000);
                            }
                        }
                    };
                    await refreshBalance();

                    // event for when typing on the value input
                    const inputAmount = async () => {
                        const value = parseFloat(amount.value);
                        const usd = content.querySelector('#values #usd');
                        usd.innerHTML = `~$${ (price.current.now * value).toFixed(2) }`;

                        // check fi valid
                        if (isNaN(value) || value <= 0) {
                            usd.innerHTML = `~$0.00`;
                        }

                        // check if there is sufficient amount
                        if (value <= parseFloat(await this.web3.getBalance()) && value > 0){
                            button.removeAttribute('disabled');
                            amount.classList.remove('red');
                        }
                    }
                    // update usd span to reflect amount value converted to usd
                    amount.addEventListener('keyup', inputAmount);

                    // click the TOKEN button
                    content.querySelector('#token .token-name').addEventListener('click', () => {
                        amount.value = content.querySelector('#values #balance').innerHTML;
                        inputAmount();
                    });

                    const gas = {
                        init: async function() {
                            // selected index
                            this.selected = 2;
                            await this.update();
                        },

                        // get the calculated selected gas price (not the index)
                        getSelected: function() {
                            return parseInt(this.list[this.selected] * 1000000000);
                        },

                        // update gas price on the list, dom and call timeout
                        update: async function() {
                            if (content){
                                setTimeout(() => this.update(), 10000);
                            }
                            this.list = (await this.get()).speeds.filter((_,i) => i < 3).map(e => e.gasPrice);
                            
                            content.querySelectorAll('#gasprice .card .value').forEach((e,i) => e.innerHTML = `${this.list[i].toFixed(1)} GWei` );
                        },

                        // get gas price from window var
                        get: async function() {
                            return new Promise( resolve => {
                                const wait = () => {
                                    if (window.gasPrice) {
                                        resolve(window.gasPrice);
                                        return;
                                    }
                                    setTimeout(() => { wait() }, 250);
                                };
                                wait();
                            });
                        },
                    };
                    await gas.init();
                    
                    // after fetching, put three cards for the user to choose from
                    const gasPriceContainer = content.querySelector('#gasprice #body');
                    gasPriceContainer.innerHTML = gas.list.map((e,i) => {
                        const speeds = [ '🛴 Slow', '🚗 Standard', '✈️ Fast'];
                        content.querySelector('#recharge-key').removeAttribute('disabled');
                        return `<div class="card ${ i == 2 ? 'selected' : '' }"><span>${speeds[i]}</span><span class="value">${e.toFixed(1)} GWei</span></div>`;
                    }).join('');

                    // event for selecting the gas cards
                    const cards = gasPriceContainer.querySelectorAll('.card');
                    cards.forEach((e,i) => e.addEventListener('click', () => {
                        cards.forEach(e => e.classList.remove('selected'));
                        e.classList.add('selected');
                        gas.selected = i;
                    }));

                    // bind event to remove red tip when typying a corret api key
                    key.addEventListener('keyup', () => {
                        const value = key.value.trim().toLowerCase();
                        if (value.match(apiKeyRegex)){
                            button.removeAttribute('disabled');
                            key.classList.remove('red');
                        }
                    });
                
                    button.addEventListener('click', async () => {
                        // check if key doesnt match regex
                        if (!key.value.match(apiKeyRegex)){
                            new Toast(`🔑 Invalid API key`, { timeOut: 3000, position: 'center' });
                            button.setAttribute('disabled', true);
                            key.classList.add('red');
                            return;
                        }
            
                        // check if there is enough balance
                        if (parseFloat(amount.value) > parseFloat(await this.web3.getBalance())) {
                            new Toast(`💸 Insufficient balance`, { timeOut: 3000, position: 'center' });
                            button.setAttribute('disabled', true);
                            amount.classList.add('red');
                            return;
                        }
                        
                        // check if amount is a valid positive value
                        if (isNaN(parseFloat(amount.value)) || parseFloat(amount.value) <= 0) {
                            new Toast(`💰 Invalid token value`, { timeOut: 3000, position: 'center' });
                            button.setAttribute('disabled', true);
                            amount.classList.add('red');
                            return;
                        }

                        // check if api key is valid
                        button.setAttribute('disabled', true);
                        button.innerHTML = '<i class="fas fa-spin fa-cog"></i>';
                        const validKey = await (async () => {
                            const data = await api.getKey(key.value);
                            return !data.error;
                        })();
                        if (!validKey) {
                            new Toast(`🔑 API key not found`, { timeOut: 3000, position: 'center' });
                            key.classList.add('red');
                            button.innerHTML = '⚡Recharge⚡';
                            return;
                        }
            
                        // start actions to send token
            
                        let toastConfirm = new Toast(`<i class="fas fa-spin fa-cog"></i><span> Waiting for confirmation...</span>`, { timeOut: 0, position: 'center' });
                        let toastAccept;
            
                        let stopError = false;
                        await new Promise(resolve => {
                            const successFlow = async (hash, { cancel=false }={}) => {
                                toastAccept.fade(1000);
                                new Toast(`Transaction ${ cancel ? 'Cancelled' : 'Confirmed' }. <a href="${ network.get().explorer.href }/tx/${ hash }" target="_blank" aria-label="view transaction" rel="noopener">View in explorer</a>.`, { timeOut: 15000, position: 'center' });

                                // since we already tracked the tx, we remove the cookie
                                cookies.delete('pending-tx-recharge');
                
                                if (!cancel) {
                                    let toastUpdate = new Toast(`<i class="fas fa-spin fa-cog"></i><span> Updating your API credit...</span>`, { timeOut: 0, position: 'center' });
                                    const data = await this.updateCredit({
                                        apiKey: key.value,
                                        transactionHash: hash
                                    });
                                    toastUpdate.fade(1000);
                    
                                    if (data.status == 200) {
                                        let bonus = '';
                                        if (data.bonus) {
                                            bonus = ` (<span class="green">+$${ parseFloat(data.bonus).toFixed(4) }</span> bonus)`;
                                        }
                                        new Toast(`🦉 Your API credit was increased by <span class="green">$${ parseFloat(data.amount.usd).toFixed(4) }</span>${bonus}. Thanks!`, { timeOut: 10000, position: 'center' });

                                        return true;
                                    }

                                    new Toast(`🦉 Something want wrong while updating your credit. Please go to our <a href="https://t.me/owlracle" target="_blank" aria-label="telegram group" rel="noopener">Telegram group</a> and inform us about this issue.`, { timeOut: 10000, position: 'center' });
                                    return false;
                                }

                                return true;
                            };

                            this.web3.send({
                                from: account,
                                to: wallet.address, // dont bother changing this, server wont recognize your tx
                                value: amount.value,
                                gasPrice: gas.getSelected(),
                            })
                            .on('error', error => {
                                if (!stopError) {
                                    new Toast(`Transaction failed. Message: <i>${ error.message }</i>`, { timeOut: 10000, position: 'center' });
                                    toastConfirm.fade(1000);
                                    if (toastAccept) {
                                        toastAccept.fade(1000);
                                    }
                                    resolve(error);
                                }
                            })
                            .on('transactionHash', async hash => {
                                // console.log(hash)
                                toastConfirm.fade(1000);
                                toastAccept = new Toast(`<i class="fas fa-spin fa-cog"></i><span> Waiting for transaction...</span>`, { timeOut: 0, position: 'center' });

                                // set cookie to tx so we can track even when page reload
                                cookies.set('pending-tx-recharge', {
                                    hash: hash,
                                    apikey: key.value,
                                }, {
                                    expires: { hours: 1 },
                                    json: true,
                                });
            
                                const confirm = await this.web3.waitConfirmation(hash);
                                if (!confirm.error && (confirm.status == 'replaced' || confirm.status == 'cancelled')) {
                                    console.log(`Found ${ confirm.status } tx: ${ confirm.tx.hash }`);
                                    await successFlow(confirm.tx.hash, { cancel: confirm.status == 'cancelled' });
                                    stopError = true;
                                    resolve(confirm.tx);
                                }
                            })
                            .on('receipt', async receipt => {
                                await successFlow(receipt.transactionHash);
                                resolve(receipt);
                            });
                        });
                        
                        refreshBalance(false);
                        button.removeAttribute('disabled');
                        button.innerHTML = '⚡Recharge⚡';
                    });

                    updatingUI = false;
                    return;
                };
                
                (async () => {
                    // import web3 from cdn
                    await new Promise(resolve => new DynamicScript('https://cdnjs.cloudflare.com/ajax/libs/web3/1.7.1/web3.min.js', () => resolve(true)));
                    this.web3 = (await import('./web3.min.js')).default;
                    this.web3.init().then(() => {
                        this.web3.on('connect', checkWalletConnection);
                        this.web3.on('networkChange', checkWalletConnection);
                        this.web3.on('accountChange', checkWalletConnection);
                
                        // after web3 load
                        checkWalletConnection();
                    });
                })();
            },

            logs: () => {
                const container = this.content[id];

                const buildTable = data => {
                    let txs = `<div class="empty">No requests found. Try to adjust the time range of your search.</div>`;
                    if (data.length > 0){
                        const tds = data.map(e => {
                            const thisNetwork = network.getList()[e.network];
            
                            return `<div class="row col-5">
                                <div class="cell">${new Date(e.timestamp).toISOString().replace('T', ' ').split('.')[0]}</div>
                                <div class="cell">${thisNetwork.name}</div>
                                <div class="cell">${e.endpoint}</div>
                                <div class="cell">${e.ip}</div>
                                <div class="cell" title="${e.origin}">${e.origin}</div>
                            </div>`;
                        }).join('');
                        txs = `<div class="row head col-5">
                            <div class="cell">Time</div>
                            <div class="cell">Network</div>
                            <div class="cell">Endpoint</div>
                            <div class="cell">IP</div>
                            <div class="cell">Origin</div>
                        </div>
                        <div class="body">${tds}</div>`;
                    }
                    txs = `<div class="table">${txs}</div>`;
                    return txs;
                };
                
                const start = async e => {
                    const key = api.isLogged();

                    if (e) {
                        const pos = e.id.split('-')[0];
                        const value = parseInt(new Date(e.value).getTime() / 1000);
                        if (pos == 'from' || !this.fromTime) {
                            this.fromTime = value;
                        }
                        else if (pos == 'to' || !this.toTime){
                            this.toTime = value;
                        }
                    }
                    const data = await api.getLogs(key, this.fromTime, this.toTime);
                    const table = buildTable(data);
                    container.querySelector('#table-container').innerHTML = table;
                }

                container.querySelectorAll('.time-range').forEach(e => e.addEventListener('input', () => start(e)));
            },

            logout: () => {
                document.querySelector('#fog').click();
                api.logout();
            },
        };

        if (bindFunctions[id]){
            bindFunctions[id]();
        }
    },
};


const startHeaderApiSearch = () => {
    api.login();

    // search api key button
    const apiButton = document.querySelector('#search #api-info');
    apiButton.addEventListener('click', async () => {
        if (!apiButton.classList.contains('loading')){
            apiButton.classList.add('loading');
            const data = await api.login();
            apiButton.classList.remove('loading');
            if (!data){
                new Toast('😖 API key not found', { timeOut: 5000 });
                return;
            }
            api.showProfile('info');
        }
    });
    
    document.querySelector('#search input').addEventListener('keyup', e => {
        if (e.key == 'Enter'){
            document.querySelector('#search #api-info').click();
        }
    });
    
    // dropdown header menu
    document.querySelector('#search #drop').addEventListener('click', async function() {
        const dropdown = document.createElement('div');
        dropdown.id = 'dropdown';

        const key = api.isLogged();
    
        const dropdownContent = ['<div id="create-key" class="item">New API Key</div>'];
        if (key) {
            dropdownContent.push(
                `<div id="info-key" class="item">View key info</div>`,
                `<div id="recharge-key" class="item">Recharge Key</div>`,
                `<div id="recharge-history" class="item">My recharges</div>`,
                `<div id="request-logs" class="item">Usage logs</div>`,
                `<div id="logout-key" class="item">Logout</div>`
            );
        }
        dropdown.innerHTML = dropdownContent.join('');
    
        dropdown.style.top = `${this.offsetTop + this.clientHeight}px`;
        dropdown.style.left = `${this.offsetLeft + this.clientWidth - 145}px`;
    
        dropdown.querySelector('#create-key').addEventListener('click', () => api.showProfile('create'));
        if (key) {
            dropdown.querySelector('#info-key').addEventListener('click', () => {
                api.showProfile('info');
            });
            
            dropdown.querySelector('#recharge-key').addEventListener('click', async () => {
                api.showProfile('recharge');
            });
            
            dropdown.querySelector('#recharge-history').addEventListener('click', async () => {
                api.showProfile('history');
            });
            
            dropdown.querySelector('#request-logs').addEventListener('click', async () => {
                api.showProfile('logs');
            });
            
            dropdown.querySelector('#logout-key').addEventListener('click', () => {
                api.logout();
            });
        }

        const fog = document.createElement('div');
        fog.id = 'fog';
        fog.classList.add('invisible');
    
    
        document.body.appendChild(fog);
        fog.appendChild(dropdown);
    
        fog.addEventListener('click', () => fog.remove());
    });
};


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

        this.parent.addEventListener('touchstart', () => {
            this.touching = true;
        }, { passive: true });

        this.parent.addEventListener(createEvent, e => {
            this.pendingCreate = true;
            setTimeout(() => {
                if (this.pendingCreate && !this.touching){
                    this.create(e);
                }
                this.touching = false;
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

// Options:
// id: put an id to the modal window
// large: modal window will have higher width
// fog.close: clicking the fog will remove the modal. default true
// fog.dark: fog will be black
// fog.invisible: fog will be invisible
// buttonClose: id of the button that will close the modal
class Modal {
    constructor(text, options = {}) {
        if (document.querySelector('#fog.modal')){
            document.querySelector('#fog.modal').remove();
        }

        const fog = document.createElement('div');
        fog.id = 'fog';
        fog.innerHTML = `<div class='modal'><div id="content">${text}</div></div>`;

        this.domObject = fog.querySelector('.modal');
        if (options.id){
            this.domObject.id = options.id;
        }
        if (options.large){
            this.domObject.classList.add('large');
        }

        this.fogClose = options.fog ? (options.fog.close || false) : true;
        if (this.fogClose){
            fog.addEventListener('click', () => fog.remove());
            fog.querySelector('div').addEventListener('click', e => e.stopPropagation());
        }

        if (options.fog && options.fog.dark){
            fog.classList.add('dark');
        }

        if (options.fog && options.fog.invisible){
            fog.classList.add('invisible');
        }

        if (options.buttonClose){
            fog.querySelector(`#${options.buttonClose}`).addEventListener('click', () => fog.remove());
        }

        document.body.appendChild(fog);
        fadeIn(fog, 500);

        if (options.events){
            options.events.forEach(event => {
                this.addEvent(event);
            })
        }
    }

    addEvent(event){
        let selector = '';
        let attr = event.tag;
        if (event.id){
            selector = '#';
            attr = event.id;
        }
        else if (event.class){
            selector = '.';
            attr = event.class;
        }

        const obj = this.domObject.querySelector(`${selector}${attr}`);
        obj.addEventListener(event.event, event.callback);

        return this;
    }

    close() {
        this.domObject.parentNode.remove();
    }
}

class Toast {
    constructor(text, { timeOut, position='right' }={}) {
        let container = document.querySelector('#toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.append(container);
        }

        this.element = document.createElement('div');
        this.element.classList.add('toast');
        this.element.innerHTML = text;
        
        this.timeOut = timeOut;
        
        if (position == 'center') {
            container.classList.add('center');
        }

        container.prepend(this.element);

        if (this.timeOut > 0) {
            this.fade();
        }
        return this;
    }

    fade(timeOut) {
        if (!timeOut) {
            timeOut = this.timeOut;
        }
        setTimeout(() => this.element.classList.add('fade'), timeOut - 1000);
        setTimeout(() => this.element.remove(), timeOut);
        setTimeout(() => {
            this.element.remove();

            if (!document.querySelector('#toast-container .toast') && document.querySelector('#toast-container')) {
                document.querySelector('#toast-container').remove();
            }
        }, timeOut);
    }
}


const infoMessageModal = {
    show: function(message) {
        if (message){
            return this.create(message);
        }

        fadeIn(this.container);
    },

    create: function(message) {
        this.container = document.createElement('div');
        this.container.innerHTML = `<div id="owlracle-info">
            <div id="message">
                <img src="https://owlracle.info/img/owl.webp" alt="owlracle logo">
                <span>${message}</span>
            </div>
            <div id="close"><i class="fas fa-times-circle"></i></div>
        </div>`;
        this.container.querySelector('#close').addEventListener('click', () => {
            this.hide();
            if (this.onClose){
                this.onClose();
            }
        });
        document.body.appendChild(this.container);
        return this.container;
    },

    hide: function() {
        fadeOut(this.container);
        // this.container.classList.add('hiddden');
    }
}


// request google recaptcha v3 token
const recaptcha = {
    ready: false,
    loading: false,

    setKey: function(key){
        this.key = key;
    },

    load: async function() {
        if (this.ready){
            return true;
        }
        else if (this.loading || !this.key){
            return new Promise(resolve => setTimeout(() => resolve(this.load()), 10));
        }

        this.loading = true;

        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.google.com/recaptcha/api.js?render=${this.key}`;

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


export { DynamicScript, theme, cookies, wallet, price, api, Tooltip, network, Modal, recaptcha, fadeIn, infoMessageModal, startHeaderApiSearch, Toast };