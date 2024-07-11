const venom = require("venom-bot");
const axios = require("axios");
const mysql = require('mysql2');
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'whatsapp_db'
};
const db = mysql.createConnection(dbConfig);

let clientInstance;

const start = (client) => {
    clientInstance = client;
    client.onMessage((message) => {
        console.log('Mensagem recebida:', message.body); // Mostra a mensagem recebida no console
        requestQueue.push({ client, message });
        processQueue();
    });
};

const apiKey = "AIzaSyBbNTFE9gMdzBHtW5yfPV6SLeLmHbyG8_I"; // Adicione sua chave de API aqui
const requestQueue = [];
let isProcessingQueue = false;

// Armazena o estado da conversa para cada cliente
const sessions = {};

// Prompt base para a IA
const basePrompt = "Você é um atendente virtual de uma pizzaria chamada Pizzaria 'Luiz da Calabresa Grande'. Atendemos de segunda a sexta das 18h às 23h, temos pizza tamanho familia e gigante, a grande custa R$80 e a gigante custa R$100, o frete para toda a cidade é R$10. Estamos localizados na marechal floriano em frente ao quiosque, se possivel, atenda os clientes com alguns emojis para deixar a mensagem mais amigavel possivel, de preferencia, quebre linhas tambem para nao ficar uma mensagem toda embaralhada e maçante.";

const processQueue = () => {
    if (isProcessingQueue || requestQueue.length === 0) return;

    isProcessingQueue = true;
    const { client, message } = requestQueue.shift();

    console.log(`Processando mensagem de ${message.from}`);

    const tryRequest = (retries) => {
        const session = sessions[message.from] || { history: [] };
        session.history.push(message.body);

        const fullPrompt = `${basePrompt}\n\nHistórico da conversa:\n${session.history.join('\n')}`;

        console.log(`Enviando prompt para API: ${fullPrompt}`);

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

module.exports = { start, requestQueue };
