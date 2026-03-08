import WebSocket from 'ws';

console.log('Testing raw websocket connection...');
const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

const timer = setTimeout(() => {
    console.error('Raw connection timed out after 10 seconds. Network or ISP is blocking WebSocket.');
    ws.close();
    process.exit(1);
}, 10000);

ws.on('open', () => {
    clearTimeout(timer);
    console.log('Successfully connected to raw WebSocket (TCP/TLS handshake completed)!');
    console.log('If this works but the API key version fails, the API key might be the issue.');
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    clearTimeout(timer);
    console.error('WebSocket Error:', err);
    process.exit(1);
});
