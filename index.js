import WebSocket, { WebSocketServer } from 'ws';
import {
    KinesisClient,
    ListShardsCommand,
    GetShardIteratorCommand,
    GetRecordsCommand,
} from '@aws-sdk/client-kinesis';

const PORT = process.env.PORT || 8080;
const REGION = process.env.AWS_REGION || 'us-east-1';
const STREAM_NAME = process.env.RESPONSE_STREAM_NAME;
if (!STREAM_NAME) throw new Error('RESPONSE_STREAM_NAME env var is required');

const kinesis = new KinesisClient({ region: REGION });
const clients = new Map(); // clientId → WebSocket

// 1. WebSocket server
const wss = new WebSocketServer({ port: PORT });
wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const clientId = params.get('clientId');
    if (!clientId) return ws.close(1008, 'clientId required');

    clients.set(clientId, ws);
    console.log(`Client connected: ${clientId}`);

    ws.on('close', () => {
        clients.delete(clientId);
        console.log(`Client disconnected: ${clientId}`);
    });

    ws.on('message', (msg) => {
        // Optionally forward raw audio chunks to your orchestrator here
        console.log(`Received message from ${clientId}: ${msg}`);
    });
});

// 2. Poll each shard
async function initShardIterators() {
    const { Shards } = await kinesis.send(
        new ListShardsCommand({ StreamName: STREAM_NAME })
    );
    for (const { ShardId } of Shards || []) {
        const { ShardIterator } = await kinesis.send(
            new GetShardIteratorCommand({
                StreamName: STREAM_NAME,
                ShardId,
                ShardIteratorType: 'LATEST',
            })
        );
        if (ShardIterator) pollShard(ShardIterator);
    }
}

async function pollShard(iterator) {
    let shardIterator = iterator;
    while (shardIterator) {
        try {
            const { Records, NextShardIterator } = await kinesis.send(
                new GetRecordsCommand({
                    ShardIterator: shardIterator,
                    Limit: 100,
                })
            );
            shardIterator = NextShardIterator;

            for (const record of Records || []) {
                const { clientId, message } = JSON.parse(
                    Buffer.from(record.Data).toString()
                );
                const ws = clients.get(clientId);
                if (ws?.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                }
            }
        } catch (err) {
            console.error('Error polling Kinesis:', err);
            await new Promise((r) => setTimeout(r, 1000));
        }
        await new Promise((r) => setTimeout(r, 200));
    }
}

initShardIterators().then(() => console.log('Kinesis polling started'));
