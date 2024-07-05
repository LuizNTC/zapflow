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

// Variáveis para fila de requisições
const apiKey = "AIzaSyBbNTFE9gMdzBHtW5yfPV6SLeLmHbyG8_I";
const requestQueue = [];
let isProcessingQueue = false;

// Armazena o estado da conversa para cada cliente
const sessions = {};

// Função para processar a fila de mensagens
const processQueue = () => {
    if (isProcessingQueue || requestQueue.length === 0) return;

    isProcessingQueue = true;
    const { client, message } = requestQueue.shift();

    const tryRequest = (retries) => {
        const session = sessions[message.from] || { history: [] };
        session.history.push(message.body);

        const fullPrompt = `${basePrompt}\n\nHistórico da conversa:\n${session.history.join('\n')}`;

        axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            "contents": [{"parts": [{"text": fullPrompt}]}]
        })
        .then((response) => {
            console.log('Resposta completa da API:', response.data); // Log da resposta completa

            // Ajuste para acessar a resposta correta
            if (response.data && response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content) {
                const contentParts = response.data.candidates[0].content.parts;
                const reply = contentParts.map(part => part.text).join("\n"); // Extrai e concatena o texto de todas as partes
                console.log('Resposta do Gemini:', reply); // Mostra a resposta do Gemini no console

                // Atualiza o histórico da sessão
                session.history.push(`Resposta da IA: ${reply}`);
                sessions[message.from] = session;

                // Envia a resposta para o WhatsApp
                client.sendText(message.from, reply)
                    .then(() => {
                        console.log('Mensagem enviada com sucesso');
                        isProcessingQueue = false;
                        processQueue();
                    })
                    .catch((err) => {
                        console.log('Erro ao enviar mensagem:', err);
                        isProcessingQueue = false;
                        processQueue();
                    });
            } else {
                throw new Error('Estrutura da resposta inesperada');
            }
        })
        .catch((err) => {
            if (err.response && err.response.status === 429 && retries > 0) {
                console.log(`Erro 429 recebido. Tentando novamente em 10 segundos... (${retries} tentativas restantes)`);
                setTimeout(() => tryRequest(retries - 1), 10000); // Tenta novamente após 10 segundos
            } else {
                console.log('Erro ao chamar API do Gemini:', err.message || err);
                isProcessingQueue = false;
                processQueue();
            }
        });
    };

    tryRequest(3); // Tenta a requisição com até 3 tentativas
};

app.post('/connect', (req, res) => {
    venom.create({
        session: `session_${Date.now()}`,
        multidevice: true,
         // Desativa o modo headless para visualizar o navegador
    }, (base64Qr, asciiQR) => {
        io.emit('qr', base64Qr); // Envia o QR code para o frontend via WebSocket
        console.log(asciiQR); // Opcional: Mostra o QR code no terminal
    })
    .then(client => {
        clientInstance = client;
        client.onMessage((message) => {
            console.log('Mensagem recebida:', message.body); // Mostra a mensagem recebida no console
            requestQueue.push({ client, message });
            processQueue();
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

server.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
