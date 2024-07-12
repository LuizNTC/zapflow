const express = require('express');
const path = require('path');
const venom = require('venom-bot');
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const MySQLStore = require('express-mysql-session')(session);
const appJs = require('./app'); // Importa o módulo app.js

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do middleware de sessão
const sessionStore = new MySQLStore({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '147258',
    database: 'whatsapp_db'
});

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false, maxAge: 86400000 } // 24 horas
}));

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '147258',
    database: 'whatsapp_db'
};

let db;

function handleDisconnect() {
    db = mysql.createConnection(dbConfig);

    db.connect(function(err) {
        if (err) {
            console.log('Erro ao conectar ao banco de dados:', err);
            setTimeout(handleDisconnect, 2000);
        } else {
            console.log('Conectado ao banco de dados MySQL.');
        }
    });

    db.on('error', function(err) {
        console.log('Erro na conexão do banco de dados:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();

// Middleware de autenticação
const checkAuth = (req, res, next) => {
    if (req.session.userId) {
        console.log('Usuário autenticado:', req.session.userId); // Adicionado para depuração
        next();
    } else {
        console.log('Usuário não autenticado. Redirecionando para login.');
        res.redirect('/login.html');
    }
};

app.get('/', (req, res) => {
    res.redirect('/index.html');
});

app.get('/index.html', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Outras rotas protegidas
app.get('/planos.html', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planos.html'));
});

app.get('/configuracoes.html', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'configuracoes.html'));
});

app.post('/register', (req, res) => {
    const { full_name, email, phone, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.query('INSERT INTO users (full_name, email, phone, password) VALUES (?, ?, ?, ?)', [full_name, email, phone, hashedPassword], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Usuário registrado com sucesso!' });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    console.log('Tentativa de login com email:', email); // Adicionado para depuração

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.log('Erro na consulta do banco de dados:', err); // Adicionado para depuração
            return res.status(500).json({ error: 'Erro no servidor' });
        }

        if (results.length === 0 || !bcrypt.compareSync(password, results[0].password)) {
            console.log('Credenciais inválidas para email:', email); // Adicionado para depuração
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        req.session.userId = results[0].id;
        req.session.save((err) => {
            if (err) {
                console.log('Erro ao salvar a sessão:', err); // Adicionado para depuração
                return res.status(500).json({ error: 'Erro ao salvar a sessão' });
            }

            console.log('Login bem-sucedido para email:', email); // Adicionado para depuração
            res.json({ message: 'Login bem-sucedido', userId: results[0].id });
        });
    });
});

app.post('/setPrompt', checkAuth, (req, res) => {
    const { basePrompt } = req.body;
    const userId = req.session.userId;

    db.query('INSERT INTO prompts (user_id, prompt_text) VALUES (?, ?) ON DUPLICATE KEY UPDATE prompt_text = ?', [userId, basePrompt, basePrompt], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Prompt configurado com sucesso!' });
    });
});


app.get('/getPrompt', checkAuth, (req, res) => {
    const userId = req.query.userId;

    db.query('SELECT prompt_text FROM prompts WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length > 0) {
            res.json({ prompt: results[0].prompt_text });
        } else {
            res.json({ prompt: '' });
        }
    });
});


let clientInstance;
const requestQueue = [];
let isProcessingQueue = false;

app.post('/connect', checkAuth, (req, res) => {
    const userId = req.session.userId;

    io.emit('connectStatus', 'Gerando QR Code');

    venom.create({
        session: `session_${userId}`,
        multidevice: true,
        headless: true // Alterado para executar em segundo plano
    }, (base64Qr, asciiQR) => {
        io.emit('qr', base64Qr);
        console.log(asciiQR);
        io.emit('connectStatus', 'Desconectado');
    })
    .then(client => {
        clientInstance = client;
        io.emit('connectStatus', 'Conectado');

        appJs.start(client);

        client.onMessage((message) => {
            console.log('Mensagem recebida:', message.body);
            requestQueue.push({ client, message });
            processQueue(userId); // Passa o userId do estabelecimento para o processQueue
        });

        res.send({ message: 'WhatsApp conectado com sucesso!' });
    })
    .catch(err => {
        io.emit('connectStatus', 'Desconectado');
        res.status(500).send({ error: err.message });
    });
});

// Endpoint de teste para verificar a sessão
app.get('/check-session', (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true, userId: req.session.userId });
    } else {
        res.json({ authenticated: false });
    }
});

const processQueue = (userId) => {
    if (isProcessingQueue || requestQueue.length === 0) return;

    isProcessingQueue = true;
    const { client, message } = requestQueue.shift();

    console.log(`Processando mensagem de ${message.from}`);

    const tryRequest = (retries) => {
        db.query('SELECT prompt_text FROM prompts WHERE user_id = ?', [userId], (err, results) => {
            if (err) {
                console.log('Erro ao recuperar prompt:', err);
                isProcessingQueue = false;
                processQueue();
                return;
            }

            if (results.length === 0) {
                console.log(`Nenhum prompt encontrado para o usuário ${userId}`);
                isProcessingQueue = false;
                processQueue();
                return;
            }

            const basePrompt = results[0].prompt_text;
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
        });
    };

    tryRequest(3); // Tenta a requisição com até 3 tentativas
};

server.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
