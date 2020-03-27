'use strict';

const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const addresses = require('./buildHosts').addresses;

// Server configuration
let baseIndexServer = process.env.BASE_INDEX || 0;
let id = getId(addresses[baseIndexServer].port);
let leaderId = getId(Math.max(...calculateLeader()));
let status = 'ok';
let isCoordinator = true;
let isUP = true;
let check = 'on';

// Servers instance
const servers = new Map();
Object.keys(addresses).forEach(key => {
    if (Number(key) !== baseIndexServer) {
        servers.set(getId(addresses[key].port), `http://${addresses[key].host}:${addresses[key].port}`)
    }
});

// App
app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true
    })
);
app.engine('pug', require('pug').__express);
app.set('views', path.join(__dirname, '../public/views'));
app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.get('/', function (req, res) {
    res.render('index', {id, idLeader: leaderId});
});

app.post('/ping', (req, res) => {
    handleRequest(req);
    sendMessage(`${new Date().toLocaleString()} - server ${req.body.id} it's pinging me`);
    res.status(200).send({serverStatus: status});
});

app.post('/isCoordinator', (req, res) => {
    handleRequest(req);
    res.status(200).send({isCoor: isCoordinator});
});

app.post('/election', (req, res) => {
    handleRequest(req);
    if (!isUP) {
        sendMessage(`${new Date().toLocaleString()} - server ${req.body.id} fallen leader`);
        res.status(200).send({accept: 'no'});
    } else {
        sendMessage(`${new Date().toLocaleString()} - server ${req.body.id} asked me if I am down, and I am not , I win, that is bullying`);
        res.status(200).send({accept: 'ok'});
    }
});

app.post('/putCoordinator', (req, res) => {
    handleRequest(req);
    startElection();
    sendMessage(`${new Date().toLocaleString()} - server ${req.body.id} put me as coordinator`);
    res.status(200).send('ok');
});

app.post('/newLeader', async (req, res) => {
    handleRequest(req);
    leaderId = req.body.idLeader;
    res.status(200).send('ok');
    io.emit('newLeader', leaderId);
    await checkLeader();
});

const checkLeader = async _ => {
    if (!isUP) {
        check = 'off';
    }
    if (id !== leaderId && check !== 'off') {
        try {
            let response = await axios.post(servers.get(leaderId) + '/ping', { id });

            if (response.data.serverStatus === 'ok'){
                sendMessage(`${new Date().toLocaleString()} - Ping to leader server ${leaderId}: ${response.data.serverStatus}`);
                setTimeout(checkLeader, 12000);
            } else {
                sendMessage(`${new Date().toLocaleString()} - Server leader  ${leaderId} down: ${response.data.serverStatus} New leader needed`);
                checkCoordinator();
            }
        }
        catch (error) {
            sendMessage(`${new Date().toLocaleString()} - Server leader  ${leaderId} down: New leader needed`);
            checkCoordinator();
            console.log(error);
        }
    }
};

const checkCoordinator = _ => {
    servers.forEach(async (value, key) => {
        try {
            let response = await axios.post(value + '/isCoordinator', {id});

            if (response.data.isCoor === 'true') {
                sendMessage(`${new Date().toLocaleString()} - server ${key} is doing the election`);
                return true;
            } else {
                sendMessage(`${new Date().toLocaleString()} - server ${key} is not doing the election`);
            }
        }
        catch (error) {
            console.log(error);
        }
    });

    if (isUP) {
        startElection();
    }
};

const startElection = _ => {
    let someoneAnswer = false;
    isCoordinator = true;
    sendMessage(`${new Date().toLocaleString()} - Coordinating the election`);

    servers.forEach(async (value, key) => {
        if (key > id) {
            try {
                let response = await axios.post(value + '/election', {id});
                if (response.data.accept === 'ok' && !someoneAnswer) {
                    someoneAnswer = true;
                    isCoordinator = false;
                    await axios.post(value + '/putCoordinator', {id});
                }
            }
            catch (error) {
                console.log(error);
            }
        }
    });

    setTimeout(() => {
        if (!someoneAnswer) {
            leaderId = id;
            sendMessage(`${new Date().toLocaleString()} - I am leader`);
            io.emit('newLeader', leaderId);
            servers.forEach(async (value) => await axios.post(value + '/newLeader', {idLeader: leaderId}))
        }
    }, 5000);
};

function getId(server) {
    return server - 10000;
}

function calculateLeader() {
    let ports = [];
    addresses.forEach(server => {
        ports.push(server.port)
    });
    return ports;
}

function sendMessage(message) {
    console.log(`Message: ${message}`);
    io.emit('status', message);
}

function handleRequest(req) {
    console.log(`${new Date().toLocaleString()} - Handle request in ${req.method}: ${req.url} by ${req.hostname}`);
}

io.on('connection', (socket) => {
    socket.on('kill', () => {
        sendMessage(`${new Date().toLocaleString()} - Not a leader anymore`);
        status = 'fail';
        isUP = false;
        isCoordinator = false;
    });
});

server.listen(addresses[baseIndexServer].port, addresses[baseIndexServer].host);
console.log(`App listening on http://${addresses[baseIndexServer].host}:${addresses[baseIndexServer].port}`);

setTimeout(checkLeader, 3000);
