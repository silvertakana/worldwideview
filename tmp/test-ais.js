import WebSocket from 'ws';

console.log('Testing AIS connection...');
const apiKey = process.env.MARITIME_API_KEY;

if (!apiKey) {
    console.error('API Key missing in .env.local');
    process.exit(1);
}

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

const timer = setTimeout(() => {
    console.error('Connection timed out after 10 seconds.');
    ws.close();
    process.exit(1);
}, 10000);

ws.on('open', () => {
    clearTimeout(timer);
    console.log('Successfully connected to AIS stream!');
    
    ws.send(JSON.stringify({
        ApiKey: apiKey,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FilterMessageTypes: ['PositionReport'],
    }));
});

ws.on('message', (data) => {
    console.log('Received first message!');
    const msg = JSON.parse(data.toString());
    console.log(msg);
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    clearTimeout(timer);
    console.error('WebSocket Error:', err);
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log(`Connection closed: ${code} - ${reason.toString()}`);
});
