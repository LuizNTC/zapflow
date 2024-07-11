document.addEventListener('DOMContentLoaded', () => {
    const loginTitle = document.getElementById('login');
    const signupTitle = document.getElementById('signup');
    const loginForm = document.querySelector('.login');
    const signupForm = document.querySelector('.signup');
    const statusElement = document.getElementById('status');

    if (loginTitle) {
        loginTitle.addEventListener('click', () => {
            signupForm.classList.add('slide-up');
            loginForm.classList.remove('slide-up');
        });
    }

    if (signupTitle) {
        signupTitle.addEventListener('click', () => {
            loginForm.classList.add('slide-up');
            signupForm.classList.remove('slide-up');
        });
    }

    const registerButton = document.getElementById('registerButton');
    if (registerButton) {
        registerButton.addEventListener('click', function(event) {
            event.preventDefault();
            const fullName = document.getElementById('registerFullName').value;
            const email = document.getElementById('registerEmail').value;
            const phone = document.getElementById('registerPhone').value;
            const password = document.getElementById('registerPassword').value;

            fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ full_name: fullName, email, phone, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Erro: ' + data.error);
                } else {
                    alert(data.message);
                }
            })
            .catch(error => {
                alert('Erro ao registrar: ' + error.message);
            });
        });
    }

    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', function(event) {
            event.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            console.log('Tentativa de login com email:', email); // Adicionado para depuração

            fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            })
            .then(response => {
                console.log('Resposta do servidor:', response); // Adicionado para depuração
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    alert('Erro: ' + data.error);
                } else {
                    console.log('Login bem-sucedido:', data); // Adicionado para depuração
                    document.cookie = "user-id=" + data.userId + "; path=/";
                    console.log('Redirecionando para index.html');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 500); // Pequeno atraso para garantir que o cookie seja salvo
                }
            })
            .catch(error => {
                alert('Erro ao fazer login: ' + error.message);
                console.log('Erro ao fazer login:', error); // Adicionado para depuração
            });
        });
    }

    const connectButton = document.getElementById('connectButton');
    if (connectButton) {
        connectButton.addEventListener('click', function() {
            const userId = getCookie('user-id');
            if (!userId) {
                window.location.href = 'login.html';
                return;
            }

            fetch('/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
            })
            .catch(error => {
                alert('Erro ao conectar: ' + error.message);
            });
        });
    }

    const setPromptButton = document.getElementById('setPromptButton');
    if (setPromptButton) {
        setPromptButton.addEventListener('click', function() {
            const userId = getCookie('user-id');
            const prompt = document.getElementById('prompt').value;

            fetch('/setPrompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ basePrompt: prompt })
            })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
            })
            .catch(error => {
                alert('Erro ao definir prompt: ' + error.message);
            });
        });
    }

    const socket = io('http://localhost:3000');

    socket.on('connectStatus', (status) => {
        statusElement.textContent = status;
        if (status === 'Conectado') {
            statusElement.classList.remove('status-disconnected');
            statusElement.classList.add('status-connected');
        } else if (status === 'Desconectado') {
            statusElement.classList.remove('status-connected');
            statusElement.classList.add('status-disconnected');
        } else if (status === 'Gerando QR Code') {
            statusElement.classList.remove('status-connected', 'status-disconnected');
            statusElement.classList.add('status-generating');
        }
    });

    socket.on('qr', function(base64Qr) {
        const qrImage = document.getElementById('qrImage');
        qrImage.src = base64Qr;
        qrImage.style.display = 'block';
    });

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            document.cookie = "user-id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.href = 'login.html';
        });
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }
});
