import { DynamicScript, theme, wallet, price, network } from './utils.js';

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