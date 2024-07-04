const express = require('express');
const path = require('path');
const venom = require('venom-bot');
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let clientInstance;
let basePrompt = '';

app.post('/connect', (req, res) => {
    venom.create({
        session: "chatGPT_BOT",
        multidevice: true,
        headless: true
    }, (base64Qr, asciiQR) => {
        io.emit('qr', base64Qr); // Envia o QR code para o frontend via WebSocket
        console.log(asciiQR); // Opcional: Mostra o QR code no terminal
    })
    .then(client => {
        clientInstance = client;
        client.onMessage((message) => {
            processMessage(client, message);
        });
        res.send({ message: 'WhatsApp conectado com sucesso!' });
    })
    .catch(err => {
        res.status(500).send({ error: err.message });
    });
});

app.post('/setPrompt', (req, res) => {
    basePrompt = req.body.basePrompt;
    res.send({ message: 'Prompt configurado com sucesso!' });
});

const processMessage = (client, message) => {
    const fullPrompt = `${basePrompt}\n\nHistórico da conversa:\n${message.body}`;
    axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
        "contents": [{"parts": [{"text": fullPrompt}]}]
    })
    .then(response => {
        const reply = response.data.candidates[0].content.parts.map(part => part.text).join("\n");
        client.sendText(message.from, reply);
    })
    .catch(err => {
        console.error('Erro ao chamar API do Gemini:', err.message || err);
    });
};

server.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
