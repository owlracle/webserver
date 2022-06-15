export default {
    instance: null,
    events: {},

    init: async function() {
        this.instance = new Web3(window.ethereum);

        // New web3 provider
        if (!window.ethereum) {
            this.providerAvailable = false;
            console.log('No web3 provider detected');
            return false;
        }

        this.injected = true;

        // check for account change
        window.ethereum.on('accountsChanged', () => {
            console.log('Account changed');
            this.changeAccount();
        });
        
        // check for network change
        window.ethereum.on('networkChanged', () => {
            console.log('Network changed');
            this.changeNetwork();
        });

        this.contract.instance = this.instance;

        if (await this.connect()){
            this.changeNetwork();
            this.changeAccount();
        }

        return true;
    },

    connect: async function() {
        if (this.injected) {
            try {
                // ask user for permission
                await ethereum.enable();
                this.connected = true;

                if (this.events.connect) {
                    this.events.connect();
                }

                return true;
            } catch (error) {
                // user rejected permission
                console.log('user rejected permission');
                return false;
            }
        }
        return false;
    },

    getAccount: async function() {
        return (await this.instance.eth.getAccounts())[0];
    },

    getNetworkId: async function() {
        return await this.instance.eth.net.getId();
    },

    getBalance: async function() {
        let balance = await this.instance.eth.getBalance(await this.getAccount());
        balance = this.instance.utils.fromWei(balance);
        return balance;
    },

    changeAccount: async function() {
        this.instance.eth.getAccounts((err, accounts) => {
            if (err != null) {
                alert("Error retrieving accounts.");
                return;
            }
            if (accounts.length == 0) {
                alert("No account found! Make sure the Ethereum client is configured properly.");
                return;
            }
            this.account = accounts[0];
            console.log('Account: ' + this.account);
            this.instance.eth.defaultAccount = this.account;

            if (this.events.accountChange) {
                this.events.accountChange(this.account);
            }
        });
    },

    changeNetwork: async function() {
        this.networkId = await this.instance.eth.net.getId();
        console.log(`Network: ${ this.networkId }`);

        if (this.events.networkChange) {
            this.events.networkChange(this.networkId);
        }
    },

    switchNetwork: async function(network) {
        try {
            await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: this.instance.utils.toHex(network.id) }],
            });
            this.changeNetwork();
        } catch (err) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (err.code === 4902) {
                console.log('Network not added');
                await this.addNetwork(network);
                await this.switchNetwork(network);
                return;
            }
            console.log(err);
        }
    },

    addNetwork: async function(network) {
        await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainName: network.longName || network.name,
                chainId: this.instance.utils.toHex(network.id),
                nativeCurrency: { name: network.token, decimals: 18, symbol: network.token },
                rpcUrls: [ network.rpc ],
            }],
        });
    },

    // register events
    on: async function(event, callback) {
        this.events[event] = callback;
    },

    contract: {
        list: {},

        add: function(addr, abi, name){
            if (typeof abi === 'string') {
                abi = JSON.parse(abi);
            }
            if (!name) {
                name = addr;
            }

            this.list[name] = new this.instance.eth.Contract(abi, addr);
            return this.list[name];
        },

        get: function(id) {
            return this.list[id];
        },
    },

    send: function({ from, to, value, gasPrice }) {
        const message = 'Waiting for tx...';
        console.log(message);

        if (this.events.status){
            this.events.status(message);
        }

        const args = {
            to: to,
            from: from, 
            value: this.instance.utils.toWei(Number(value).toString(), "ether"),
        };

        if (gasPrice ) {
            args.gasPrice = gasPrice;
        }

        return this.instance.eth.sendTransaction(args);
    },

    waitConfirmation: async function(hash, { interval = 1000, verbose = false }={}) {
        if (verbose) console.log(`Checking tx ${hash}...`);

        const tx = {};
        tx.hash = hash;
        // startBlock gives infor about where start to look if tx expired.
        tx.startBlock = await this.instance.eth.getBlockNumber();

        const getTx = async () => {
            try {
                const confirm = await this.instance.eth.getTransaction(hash);
                // tx expired
                if (!confirm) {
                    if (verbose) console.log('Tx expired. Searching for replacement tx...');
                    // find the replacemente tx
                    const newTx = await this.findReplacementTx(tx);
                    if (newTx.status == 'success') {
                        if (verbose) console.log('Found replacemente tx');
                        return { status: newTx.cancel ? 'cancelled' : 'replaced', tx: newTx.tx };
                    }
                    return { error: true, status: 'fail', response: 'Could not find Tx' };
                }
    
                // console.log(confirm)
    
                // not ready yet
                if (!confirm.blockNumber){
                    if (!tx.nonce) {
                        tx.nonce = confirm.nonce;
                        tx.from = confirm.from.toLowerCase();
                    }
    
                    return await new Promise(resolve => setTimeout(async () => {
                        const wait = await getTx();
                        resolve(wait);
                    }, interval));
                }
    
                if (verbose) {
                    console.log('Tx confirmed:');
                    console.log(confirm);
                }
                return { status: 'confirmed', tx: confirm };
            }
            catch (error) {
                if (verbose) {
                    console.log('Tx error:');
                    console.log(error);
                }
                return { error: true, status: 'error', response: error };
            }        
        };
        return await getTx();
    },

    findReplacementTx: async function(tx) {
        // block now
        const thisBlock = await this.instance.eth.getBlockNumber();
        let n = tx.startBlock;
        // max blocks to look after the nowblock. to avoid infinite loop
        const maxScanLength = 20;
        while (n - thisBlock < maxScanLength) {
            // console.log(`Scanning block ${n}`);
            const block = await this.instance.eth.getBlock(n, true);
            // if block not ready keep looping without increasing n
            if (block){
                // ignore blocks with no txs
                if (block.transactions){
                    // console.log(block.transactions.map(e => [e.blockNumber, e.from, e.nonce]));
                    // get tx with same from and nonce field
                    const match = block.transactions.filter(t => t.from.toLowerCase() == tx.from && t.nonce == tx.nonce);
                    if (match.length) {
                        const res = { status: 'success', tx: match[0] };
                        // to == from: cancellation tx, else: speed up tx
                        if (match[0].from == match[0].to) {
                            res.cancel = true;
                        }
                        return res;
                    }
                }
                n++;
            }
        }
        return { status: 'fail', message: 'Could not find the replacement tx' };
    },
};
