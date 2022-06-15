import { network } from './utils.min.js';

const container = document.querySelector('#card-container');
Object.values(network.getList()).filter(e => !e.disabled).forEach(e => {
    container.insertAdjacentHTML('beforeend', `<a class="item" href="/${ e.symbol }">
        <div class="time-sign"></div>
        <div class="col">
            <div class="row title">
                <img class="icon" src="img/${ e.symbol }.png">
                <span class="name">${ e.name }</span>
            </div>
            <span class="row rpc">RPC: <span class="placeholder"></span></span>
            <span class="row time">Last Update: <span class="placeholder"></span></span>
        </div>
    </a>`);
});

const refresh = async () => {
    const data = await (await fetch(`/rpc`)).json();
    // console.log(data)
    const now = parseInt(new Date().getTime() / 1000);
    const maxTime = 300;

    Object.values(network.getList()).filter(e => !e.disabled).forEach((e,i) => {
        const dataNet = data.find(d => d.network == e.symbol);
        const timeDiff = now - (dataNet.lastTime || 0);

        container.querySelectorAll('.item .row.rpc')[i].innerHTML = dataNet.rpc ? `RPC: <span class="grey">${ dataNet.rpc }</span>` : `<span class="grey">No info about RPC</span>`;
        container.querySelectorAll('.item .row.time')[i].innerHTML = dataNet.lastTime ? `Last Update: <span class="grey">${ timeDiff }s ago</span>` : '<span class="grey">No info about last update</span>';
        
        const timeSign = container.querySelectorAll('.time-sign')[i];
        const rate = Math.min(timeDiff, maxTime) / maxTime;
        const color = {b: '00', toString: color => '00'.slice(color.toString(16).length) + color.toString(16)};
        color.r = color.toString(Math.round(rate * 200));
        color.g = color.toString(Math.round((1 - rate) * 200));
        timeSign.style['background-color'] = `#${color.r}${color.g}${color.b}`;  
    });
};
refresh();

setInterval(refresh, 5000);