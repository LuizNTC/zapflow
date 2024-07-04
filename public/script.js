document.getElementById('connectButton').addEventListener('click', function() {
    fetch('http://localhost:3000/connect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
    })
    .catch(error => {
        alert('Erro ao conectar: ' + error.message);
    });
});

document.getElementById('setPromptButton').addEventListener('click', function() {
    const prompt = document.getElementById('prompt').value;
    fetch('http://localhost:3000/setPrompt', {
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

const socket = io('http://localhost:3000');
socket.on('qr', function(base64Qr) {
    const qrImage = document.getElementById('qrImage');
    qrImage.src = base64Qr;
    qrImage.style.display = 'block';
});
