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

// fetch bnb price from binance and update the pages's ticker
const price = {
    current: 0,
    element: document.querySelector('#price'),
    token: 'BNB',

    get: async function() {
        let price;
        let price24h;

        try {
            const url = `https://api.binance.com/api/v3/ticker/price?symbol=${this.token}USDT`;
            const url24 = `https://api.binance.com/api/v3/ticker/24hr?symbol=${this.token}USDT`;
    
            price = (await (await fetch(url)).json()).price;
            price24h = (await (await fetch(url24)).json()).priceChangePercent;
        }
        catch (error) {
            const data = await (await fetch(`/tokenprice/${this.token}`)).json();
            [ price, price24h ] = [ data.price, data.change24h ];
        }
        finally {
            return {
                now: parseFloat(price).toFixed(2),
                changePercent: parseFloat(price24h).toFixed(2), 
            }
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
        avax: { symbol: 'avax', name: 'Avalanche', token: 'AVAX', id: 43114, explorer: {
            icon: 'https://snowtrace.io/images/favicon.ico', href: 'https://snowtrace.io', name: 'SnowTrace', apiAvailable: true,
        }, rpc: 'https://api.avax.network/ext/bc/C/rpc',  },
        bsc: { symbol: 'bsc', name: 'BSC', longName: 'BNB Chain', token: 'BNB', id: 56, explorer: {
            icon: 'https://bscscan.com/images/favicon.ico', href: 'https://bscscan.com', name: 'BscScan', apiAvailable: true,
        }, rpc: 'https://bsc-dataseed.binance.org/',  },
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
        ht: { symbol: 'ht', name: 'Heco', token: 'HT', id: 128, explorer: {
            icon: 'https://hecoinfo.com/favicon.ico', href: 'https://hecoinfo.com', name: 'HecoInfo', apiAvailable: false,
        }, rpc: 'https://http-mainnet.hecochain.com',  },
        celo: { symbol: 'celo', name: 'Celo', token: 'CELO', id: 42220, explorer: {
            icon: 'https://avatars.githubusercontent.com/u/37552875?s=200&v=4', href: 'https://explorer.celo.org', name: 'Celo Explorer', apiAvailable: false,
        }, rpc: 'https://forno.celo.org',  },
        movr: { symbol: 'movr', name: 'Moonriver', token: 'MOVR', id: 1285, explorer: {
            icon: 'https://moonriver.moonscan.io/images/favicon.ico', href: 'https://moonriver.moonscan.io/', name: 'MoonScan', apiAvailable: true,
        }, rpc: 'https://rpc.moonriver.moonbeam.network',  },
    },
    
    get: function(name) {
        if (!name){
            name = cookies.get('network') || 'eth';
        }

        return this.list[name];
    },

    getById: function(id) {
        const match = Object.values(this.list).filter(e => e.id == id);
        return match.length ? match[0] : false;
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
            const checkboxes = tabsContent.create.querySelectorAll('#checkbox-container input');
            if (checkboxes[0].checked && checkboxes[1].checked){
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

    createRechargeApiContent: async function(){
        const tabsContent = this.tabsContent;

        tabsContent.recharge.innerHTML = `<h2>API key credit recharge</h2>
        <p>Connect your wallet to recharge your API key</p>
        <div id="button-container" class="vertical"></div>`;

        let updatingUI = false;
       
        const checkWalletConnection = async () => {
            // if (updatingUI) {
            //     return;
            // }

            updatingUI = true;

            if (!this.web3 || !this.web3.injected){
                tabsContent.recharge.innerHTML = `<h2>API key credit recharge</h2>
                <p>You must get Metamask to connect to your wallet</p>
                <div id="button-container" class="vertical"><button>Get Metamask</button></div>`;
                bind('not injected');
                return;
            }
            if (!this.web3.connected) {
                tabsContent.recharge.innerHTML = `<h2>API key credit recharge</h2>
                <p>Connect your wallet to recharge your API key</p>
                <div id="button-container" class="vertical"><button>Connect</button></div>`;
                bind('not connected');
                return;
            }

            const connectedNetwork = network.getById(await this.web3.getNetworkId());
            if (!connectedNetwork) {
                tabsContent.recharge.innerHTML = `<h2>API key credit recharge</h2>
                <p>Network not supported</p>
                <div id="button-container" class="vertical"><button>Switch to ${network.get().name} network</button></div>`;
                bind('unsupported network');
                return;
            }
            if (connectedNetwork.id != network.get().id) {
                tabsContent.recharge.innerHTML = `<h2>API key credit recharge</h2>
                <p>Wrong network</p>
                <div id="button-container" class="vertical">
                    <button>Switch to ${network.get().name} network</button>
                    <a href="/${connectedNetwork.symbol}"><button>Go to ${connectedNetwork.name} app</button></a>
                </div>`;
                bind('wrong network');
                return;
            }

            tabsContent.recharge.innerHTML = `<h2>API key credit recharge</h2>
            <p class="title">Connected Wallet</p>
            <div class="input-container">
                <input type="text" class="input-text keys" id="wallet" readonly>
                <div class="input-button">
                    <span id="network-icon"></span>
                </div>
            </div>
            <p class="title">API key</p>
            <input type="text" class="input-text keys" id="key" placeholder="00000000000000000000000000000000">
            <p class="title">Recharge amount</p>
            <div class="input-container">
                <input type="text" class="input-text keys" id="amount" placeholder="0.0000">
                <div id="token" class="input-button">
                    <span class="token-name"></span>
                </div>
            </div>
            <p class="title" id="values">
                <span id="usd">~$0.00</span>
                <span>Balance: <span id="balance">0.0000</span><span class="token-name"></span></span>
            </p>
            <div id="gasprice">
                <div id="title">
                    <img src="https://owlracle.info/img/owl.webp" alt="owlracle logo">
                    <psna>Gas Price</span>
                </div>
                <div id="body">
                    <i class="fas fa-spin fa-cog"></i>
                    <span>Let me handle this </span>
                </div>
            </div>
            <div id="button-container"><button id="recharge-key">⚡Recharge⚡</button></div>`;

            const account = await this.web3.getAccount();
            tabsContent.recharge.querySelector('#wallet').value = `${account.slice(0,6)}...${account.slice(-4)}`;
            tabsContent.recharge.querySelector('#network-icon').innerHTML = `<img src='img/${network.get().symbol}.png'>`;
            tabsContent.recharge.querySelectorAll('.token-name').forEach(e => e.innerHTML = network.get().token);
            await this.refreshBalance();

            // get gas price recommended by owlracle
            // let gas = window.gasPrice.speeds[2].gasPrice;
            // gas = this.instance.utils.toWei(gas.toFixed(0).toString(), "gwei");

            // after fetching, put three cards for the user to choose from

            bind('OK');
            updatingUI = false;
            return;
        }

        const bind = status => {
            const buttons = tabsContent.recharge.querySelectorAll('button');

            // update usd span to reflect amount value converted to usd
            if (status == 'OK') {
                const amount = tabsContent.recharge.querySelector('#amount');
                amount.addEventListener('keyup', async () => {
                    const usd = tabsContent.recharge.querySelector('#values #usd');
                    usd.innerHTML = `~$${ (price.current.now * parseFloat(amount.value)).toFixed(2) }`;
    
                    if (isNaN(parseFloat(amount.value)) || parseFloat(amount.value) <= 0) {
                        usd.innerHTML = `~$0.00`;
                    }
                });
            }
            
            buttons.forEach((e,i) => {
                if (!e.hasListener) {
                    e.addEventListener('click', async () => {
                        if (status == 'not injected'){
                            window.open('https://metamask.io/');
                            document.querySelector('#fog').click();
                            return;
                        }
                        if (status == 'not connected') {
                            await this.web3.connect();
                            return;
                        }
                        if (status == 'unsupported network' || status == 'wrong network') {
                            if (i == 0){
                                await this.web3.switchNetwork(network.get());
                            }
                            return;
                        }
                        if (status == 'OK') {
                            const account = await this.web3.getAccount();
                            const key = tabsContent.recharge.querySelector('#key');
                            const amount = tabsContent.recharge.querySelector('#amount');
                            const apiKeyRegex = this.regex.apiKey;
                            const button = tabsContent.recharge.querySelector('button');
                            const gasPrice = tabsContent.recharge.querySelector('.radio');

                            // bind event to remove red tip when typying a corret api key
                            key.addEventListener('keyup', () => {
                                const value = key.value.trim().toLowerCase();
                                if (value.match(apiKeyRegex)){
                                    button.removeAttribute('disabled');
                                    key.classList.remove('red');
                                }
                            });
                    
                            // check if there is sufficient amount
                            amount.addEventListener('keyup', async () => {
                                const value = parseFloat(amount.value);
                                if (value <= parseFloat(await this.web3.getBalance()) && value > 0){
                                    button.removeAttribute('disabled');
                                    amount.classList.remove('red');
                                }
                                
                                if (isNaN(parseFloat(amount.value)) || parseFloat(amount.value) <= 0) {
                                    tabsContent.recharge.querySelector('#values #usd').innerHTML = `~$0.00`;
                                }
                                else {
                                    tabsContent.recharge.querySelector('#values #usd').innerHTML = `~$${ (price.current.now * value).toFixed(2) }`;
                                }
                            });
                    
                            // check if key doesnt match regex
                            if (!key.value.match(apiKeyRegex)){
                                new Toast(`❌ Invalid API key`, { timeOut: 3000, position: 'center' });
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
                
                            button.setAttribute('disabled', true);
                            button.innerHTML = '<i class="fas fa-spin fa-cog"></i>';

                            let toastConfirm = new Toast(`<i class="fas fa-spin fa-cog"></i><span> Waiting for confirmation...</span>`, { timeOut: 0, position: 'center' });
                            let toastAccept;
            
                            await new Promise(resolve => this.web3.send({
                                from: account,
                                to: wallet.address, // dont bother changing this, server wont recognize your tx
                                value: amount.value,
                                gasPrice: gasPrice.value,
                            })
                            .on('error', error => {
                                new Toast(`Transaction failed. Message: <i>${ error.message }</i>`, { timeOut: 10000, position: 'center' });
                                toastConfirm.fade(1000);
                                if (toastAccept) {
                                    toastAccept.fade(1000);
                                }
                                resolve(error);
                            })
                            .on('transactionHash', hash => {
                                toastConfirm.fade(1000);
                                toastAccept = new Toast(`<i class="fas fa-spin fa-cog"></i><span> Waiting for transaction...</span>`, { timeOut: 0, position: 'center' });
                            })
                            .on('receipt', async receipt => {
                                toastAccept.fade(1000);
                                new Toast(`Transaction Confirmed. <a href="${ network.get().explorer.href }/tx/${ receipt.transactionHash }" target="_blank" aria-label="view transaction" rel="noopener">View in explorer</a>.`, { timeOut: 15000, position: 'center' });

                                const data = await this.updateCredit({
                                    apiKey: key.value,
                                    transactionHash: receipt.transactionHash
                                });

                                if (data.status == 200) {
                                    let bonus = '';
                                    if (data.bonus) {
                                        bonus = ` (<span class="green">+$${ parseFloat(data.bonus).toFixed(4) }</span> bonus)`;
                                    }
                                    new Toast(`🦉 Your API credit was increased by <span class="green">$${ parseFloat(data.amount.usd).toFixed(4) }</span>${bonus}. Thanks!`, { timeOut: 10000, position: 'center' });
                                }

                                resolve(receipt);
                            }));
                            
                            this.refreshBalance(false);
                            button.removeAttribute('disabled');
                            button.innerHTML = '⚡Recharge⚡';
                        }
                    });
                    e.hasListener = true;
                }
            });
        }

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
        
    },

    refreshBalance: async function(loop=true) {
        const balanceDOM = this.tabsContent.recharge.querySelector('#values #balance');
        if (balanceDOM) {
            balanceDOM.innerHTML = (await this.web3.getBalance()).slice(0,9);
            if (loop) {
                setTimeout(() => this.refreshBalance(), 5000);
            }
        }
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
                <ul>
                    <li>Make sure to save this information before closing this window.</li>
                    <li>We do not store your key and secret in plain text, so we cannot recover them in case of loss.</li>
                </ul>
                <p><a class="link" href="https://t.me/owlracle_gas_bot?start=credit" rel="noopener" target="_blank">Receive Telegram alerts about API credits.</a></p>
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
            const blacklist = ['usage', 'creditNotification'];
            const fields = Object.entries(data).filter(e => !blacklist.includes(e[0])).map(e => {
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
                    return '';
                    // input = `<div class="input-container">${input}<div id="copy" class="input-button" title="Copy"><i class="far fa-copy"></i></div></div>`;
                }
                if (e[0] == 'credit'){
                    input = `<div class="input-container">${input}<div id="update" class="input-button" title="Update"><i class="fas fa-sync-alt"></i></div></div>`;
                }
                else if (e[0] == 'origin'){
                    input = `<div class="input-container">${input}<a id="open-link" class="input-button" title="Open Link" href="https://${value}" target="_blank" rel="noopener nofollow"><i class="fas fa-external-link-alt"></i></a></div>`;
                }
                return `<p class="title">${label}</p>${input}`;
            }).join('');

            let alertLink = '';
            console.log(data)
            if (!data.creditNotification) {
                alertLink = `<a class="link" href="https://t.me/owlracle_gas_bot?start=credit" rel="noopener" target="_blank">Get notified when running out of credits!</a>`;
            }

            modal.innerHTML = `<div id="content">
                <h2>API key information</h2>
                ${fields}
                ${alertLink}
                <div id="button-container">
                    <button id="credit">History</button>
                    <button id="close">Close</button>
                </div>
            </div>`;

            // modal.querySelector('#copy').addEventListener('click', function(){
            //     const parent = this.closest('.input-container');
            //     api.copyText(parent);
            // });
            
            modal.querySelector('#update').addEventListener('click', function(){
                this.classList.add('clicked');
                setTimeout(() => this.classList.remove('clicked'), 700);
                modal.querySelector('#input-credit').value = '...';
                refreshCredit(key);
            });
            
            const historyButton = modal.querySelector('#credit');
            historyButton.addEventListener('click', async () => {
                historyButton.innerHTML = '<i class="fas fa-cog fa-spin"></i>';
                historyButton.setAttribute('disabled', true);
            
                const data = await this.getCredit(key);
                this.showWindowCredit(key, data);
            });    

            async function refreshCredit(key){
                const modal = document.querySelector('#fog #api-window');
                if (modal && modal.querySelector('#input-credit')){
                    await api.updateCredit({ apiKey: key });
                    const data = await api.getKey(key);

                    // if even after await you are still on the same window
                    if (modal && modal.querySelector('#input-credit') && key == modal.querySelector('.input-text').value){
                        modal.querySelector('#input-credit').value = `$${parseFloat(data.credit).toFixed(6)}`;
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
        // console.log(data)
        const ntw = network.get();
        const modal = document.querySelector('#fog #api-window');

        let txs = `<div class="empty">No transactions found. Try sending some ${ntw.token} to your API wallet.</div>`;
        if (data.results.length > 0){
            modal.classList.add('large');

            const tds = data.results.map(e => {
                const thisNetwork = network.getList()[e.network];

                return `<div class="row">
                    <div class="cell"><a href="${thisNetwork.explorer.href}/tx/${e.tx}" target="_blank" rel="noopener nofollow">${e.tx.slice(0,6)}...${e.tx.slice(-4)}</a></div>
                    <div class="cell">${new Date(e.timestamp).toISOString().replace('T', ' ').split('.')[0]}</div>
                    <div class="cell">${thisNetwork.name}</div>
                    <div class="cell"><a href="${thisNetwork.explorer.href}/address/${e.fromWallet}" target="_blank" rel="noopener nofollow">${e.fromWallet.slice(0,6)}...${e.fromWallet.slice(-4)}</a></div>
                    <div class="cell">${parseFloat(e.price).toFixed(4)}</div>
                    <div class="cell">${(parseInt(e.value) * 0.000000001).toFixed(6)}</div>
                </div>`;
            }).join('');
            txs = `<div class="row head">
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
        
        modal.innerHTML = `<div id="content">
            <h2>API recharge history</h2>
            <p id="key-show">${key}</p>
            ${txs}
            <p id="missing">Missing tx? <a href="https://t.me/owlracle" target="_blank" rel="noopener">contact us</a>!</p>
            <div id="button-container"><button id="close">Close</button></div>
        </div>`;
        
        modal.querySelector('#close').addEventListener('click', () => document.querySelector('#fog').remove());
    },

    showModal: function(tabSelected){
        const fog = document.createElement('div');
        fog.id = 'fog';
        fog.innerHTML = `<div id='api-window' class="modal">
            <div id='tab-container'>
                <div class="tab" id="info"><i class="fas fa-eye"></i><span class="text">Key Info</span></div>
                <div class="tab" id="edit"><i class="fas fa-edit"></i><span class="text">Edit Key</span></div>
                <div class="tab" id="create"><i class="fas fa-plus"></i><span class="text">Create Key</span></div>
                <div class="tab" id="recharge"><i class="fa-solid fa-dollar-sign"></i><span class="text">Recharge Key</span></div>
                <div class="tab" id="close-tab"><i class="fas fa-times"></i></div>
            </div>
            <div id='content'></div>
        </div>`;

        const tabsContent = Object.fromEntries(['info', 'edit', 'create', 'recharge'].map(e => [e, (() => {
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
        this.createRechargeApiContent();

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


const startHeaderApiSearch = () => {
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
            <div id="recharge-key" class="item">Recharge API key</div>
        `;
    
        dropdown.style.top = `${this.offsetTop + this.clientHeight}px`;
        dropdown.style.left = `${this.offsetLeft + this.clientWidth - 145}px`;
    
        dropdown.querySelectorAll('.item').forEach(e => e.addEventListener('click', () => api.showModal(e.id.split('-')[0])));
        
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


export { DynamicScript, theme, cookies, wallet, price, api, Tooltip, network, Modal, recaptcha, fadeIn, infoMessageModal, startHeaderApiSearch };