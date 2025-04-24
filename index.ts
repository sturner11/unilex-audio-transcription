import {
    APIGatewayProxyEventV2,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import {
    SageMakerRuntimeClient,
    InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import {
    TranslateClient,
    TranslateTextCommand,
} from '@aws-sdk/client-translate';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';

// AWS SDK v3 clients
const smrClient = new SageMakerRuntimeClient({});
const translateClient = new TranslateClient({});
const kinesisClient = new KinesisClient({ region: process.env.AWS_REGION });

// Environment variables
const WHISPER_ENDPOINT_NAME = process.env.WHISPER_ENDPOINT_NAME!;
const RESPONSE_STREAM_NAME = process.env.RESPONSE_STREAM_NAME!;

function badRequest(message: string): APIGatewayProxyStructuredResultV2 {
    return { statusCode: 400, body: JSON.stringify({ error: message }) };
}

export async function handler(
    event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
    try {
        if (!event.body) return badRequest('Empty request body');
        const audioBuf = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : Buffer.from(event.body, 'binary');

        // Call Whisper endpoint
        const whisperCmd = new InvokeEndpointCommand({
            EndpointName: WHISPER_ENDPOINT_NAME,
            Body: audioBuf,
            ContentType: 'audio/L16; rate=48000; channels=1',
            Accept: 'application/json',
        });
        const whisperResp = await smrClient.send(whisperCmd);
        const rawBody = Buffer.from(whisperResp.Body!);
        const payloadObj = JSON.parse(rawBody.toString());
        const transcript: string = payloadObj.text ?? '';

        // Optional Translate logic omitted

        // Publish to Kinesis for WebSocket server to consume
        const record = {
            StreamName: RESPONSE_STREAM_NAME,
            Data: Buffer.from(
                JSON.stringify({
                    clientId: '',
                    message: { text: transcript, isFinal: true },
                })
            ),
            PartitionKey: 'partitionKey',
        };
        await kinesisClient.send(new PutRecordCommand(record));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ transcript }),
        };
    } catch (err: any) {
        console.error('Orchestrator error', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
}
