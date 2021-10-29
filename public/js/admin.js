import { DynamicScript, theme, wallet, price, network, cookies, Modal, api } from './utils.js';

new DynamicScript('https://kit.fontawesome.com/c1a16f97ec.js');

theme.load();
document.querySelector('#theme').addEventListener('click' , () => theme.toggle());


// place network button in header
const obj = document.querySelector('#network-btn');
obj.classList.add(network.symbol);
obj.querySelector('.name').innerHTML = network.name;
obj.querySelector('.icon').src = `img/${network.symbol}.png`;


// network button action
obj.addEventListener('click', function() {
    const dropdown = document.createElement('div');
    dropdown.id = 'dropdown';

    dropdown.innerHTML = Object.entries(networks).map(([k,v]) => `<div id="${k}" class="item"><a href="/${k}"><img class="icon" src="img/${k}.png"><span class="name">${v.name}</span></a></div>`).join('');

    dropdown.style.top = `${this.offsetTop + this.clientHeight}px`;
    dropdown.style.left = `${this.offsetLeft + this.clientWidth - 130}px`;

    const fog = document.createElement('div');
    fog.id = 'fog';
    fog.classList.add('invisible');

    document.body.appendChild(fog);
    fog.appendChild(dropdown);

    fog.addEventListener('click', () => fog.remove());
});

document.querySelectorAll('.token-name').forEach(e => e.innerHTML = network.token);
document.querySelectorAll('.chain-symbol').forEach(e => e.innerHTML = network.symbol);
document.querySelectorAll('.chain-name').forEach(e => e.innerHTML = network.name);

// set the right token to price fetch according to the network
price.token = network.token;
price.update();
setInterval(() => price.update(), 10000); // update every 10s

// set network block explorer in footer
const explorer = document.querySelector('footer .resources #explorer');
explorer.href = network.explorer.href;
explorer.querySelector('img').src = network.explorer.icon;
explorer.querySelector('.name').innerHTML = network.explorer.name;

// set donation wallet modal
wallet.loadImg(document.querySelector('#donate'), network);
document.querySelectorAll('.donate-link').forEach(e => wallet.bindModal(e, network));


// check if admin is logged in
const session = cookies.get('session');
if (!session){
    const buttonPress = modal => {
        modal = modal.domObject;
        const value = modal.querySelector('input').value.trim();
        
        const button = modal.querySelector('button');
        button.innerHTML = `<i class="fas fa-spin fa-cog"></i>`;
        button.setAttribute('disabled', true);
        modal.querySelector('input').setAttribute('disabled', true);
        
        // request a new session from backend if passowrd is correct
        api.request(`/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: value }),
        }).then(data => {
            document.querySelector('#fog').remove();

            // fail. reload window to ask again
            if (data.error){
                new Modal(`<h2>${data.error}</h2>
                    <p>${data.message}</p>
                    <div id="button-container"><button id="close">OK</button></div>`,
                ).addEvent({ tag: 'button', event: 'click', callback: () => window.location.reload() });
                return;
            }
            // success, set cookie session and reload window
            else {
                cookies.set('session', data.sessionId, { expires: { hours: 1 } });
                window.location.reload();
            }
        });
    }

    // not logged, ask for password
    const modal = new Modal(`<h2>Admin Login</h2>
        <div class="input-container">
            <input class="input-text" type="password">
            <button class="input-button"><i class="fas fa-sign-in-alt"></i></button>
        </div>
    `, {
        id: 'admin-login',
        fogClose: false,
    });
    // call button press
    modal.addEvent({ tag: 'button', event: 'click', callback: () => buttonPress(modal) })
    modal.addEvent({ class: 'input-text', event: 'keyup', callback: e => {
        if (e.key == 'Enter') {
            buttonPress(modal)
        }
    }});
}
// has cookie session. check if its valid
else{
    // console.log(session)
    api.request(`/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSession: session }),
    }).then(data => {
        // fail. remove cookie session and reload window
        if (data.error){
            cookies.delete('session');
            window.location.reload();
        }
        // success, refresh cookie session be happy
        else {
            cookies.set('session', session, { expires: { hours: 1 } });

            console.log('success')
        }
    });

}

