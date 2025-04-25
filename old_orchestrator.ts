/*
 * Unilex Orchestrator Lambda (TypeScript)
 * --------------------------------------
 * This function is triggered by Amazon API Gateway (HTTP API).  It expects the
 * request body to contain **binary audio** data *base64‑encoded* (the default
 * API Gateway binary passthrough for audio/*).  If `isBase64Encoded === true`,
 * we decode to a Buffer and forward it to the Whisper SageMaker endpoint.
 *
 * 1.  Call Whisper endpoint → Spanish/English transcript (and, if configured,
 *     built‑in Whisper translate → English).
 * 2.  Optionally call Amazon Translate when TRANSLATE_ENABLED === "true".
 * 3.  Call Grammar‑Feedback endpoint.
 * 4.  Return JSON with transcript, translation, and grammar suggestions.
 *
 * Environment variables (set in Lambda console or CDK):
 *   WHISPER_ENDPOINT_NAME   = whisper-endpoint
 *   TRANSLATE_ENABLED       = "true" | "false"
 *   DEST_LANG               = "en"  # target language for translation
 *   GRAMMAR_ENDPOINT_NAME   = grammar-endpoint
 *   AWS_REGION              = e.g. us-east-1 (injected automatically)
 *
 * IAM permissions required (see Step 1 policy snippet):
 *   sagemaker:InvokeEndpoint on both endpoints
 *   translate:TranslateText  (if translation enabled)
 *   (kms access if your S3/SageMaker endpoints are KMS‑encrypted)
 */

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

// AWS SDK v3 clients – they will auto‑pick up region from env.
const smrClient = new SageMakerRuntimeClient({});
const translateClient = new TranslateClient({});

// ENV -----------------------------------------------------------------------
const WHISPER_ENDPOINT_NAME = process.env.WHISPER_ENDPOINT_NAME!; // required
// const TRANSLATE_ENABLED = process.env.TRANSLATE_ENABLED === 'true';
// const DEST_LANG = process.env.DEST_LANG ?? 'en';
// const GRAMMAR_ENDPOINT_NAME = process.env.GRAMMAR_ENDPOINT_NAME!;

// Helpers -------------------------------------------------------------------
function badRequest(message: string): APIGatewayProxyStructuredResultV2 {
    return { statusCode: 400, body: JSON.stringify({ error: message }) };
}

// Lambda handler -------------------------------------------------------------
export async function handler(
    event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
    try {
        console.log(
            'Raw event:',
            JSON.stringify({
                isBase64Encoded: event.isBase64Encoded,
                headers: event.headers,
                bodyLength: event.body?.length,
            })
        );

        if (!event.body) return badRequest('Empty request body');

        console.log('event.body[0..50]:', event.body.substring(0, 50));

        const audioBuf = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : Buffer.from(event.body, 'binary');

        console.log('Decoded buffer length:', audioBuf.length);
        console.log('First 10 bytes:', audioBuf.slice(0, 10));

        const whisperCmd = new InvokeEndpointCommand({
            EndpointName: WHISPER_ENDPOINT_NAME,
            Body: audioBuf,
            ContentType: 'audio/L16; rate=48000; channels=1',
            Accept: 'application/json',
        });

        const whisperResp = await smrClient.send(whisperCmd);

        // right after: const whisperResp = await smrClient.send(whisperCmd);
        const rawBody = Buffer.from(whisperResp.Body!);
        console.log('SageMaker raw response:', rawBody.toString());
        let whisperPayload: any;
        try {
            whisperPayload = JSON.parse(rawBody.toString());
        } catch (e) {
            console.error('Could not JSON-parse SageMaker response:', rawBody);
            throw e;
        }
        console.log('Parsed payload:', whisperPayload);

        let payloadObj: any = whisperPayload;
        if (
            Array.isArray(whisperPayload) &&
            typeof whisperPayload[0] === 'string'
        ) {
            payloadObj = JSON.parse(whisperPayload[0]);
            console.log('Unwrapped payload:', payloadObj);
        }
        // const segments = payloadObj.segments;

        // const whisperPayload = JSON.parse(
        //     Buffer.from(whisperResp.Body!).toString()
        // );
        const transcript: string = payloadObj.text ?? '';

        // let translation = '';
        // if (TRANSLATE_ENABLED && transcript) {
        //     const translateCmd = new TranslateTextCommand({
        //         Text: transcript,
        //         SourceLanguageCode: 'auto',
        //         TargetLanguageCode: DEST_LANG,
        //     });
        //     const translateResp = await translateClient.send(translateCmd);
        //     translation = translateResp.TranslatedText ?? '';
        // }

        // let grammar = '';
        // if (GRAMMAR_ENDPOINT_NAME && translation) {
        //   const grammarCmd = new InvokeEndpointCommand({
        //     EndpointName: GRAMMAR_ENDPOINT_NAME,
        //     Body: Buffer.from(JSON.stringify({ text: translation })),
        //     ContentType: 'application/json',
        //     Accept: 'application/json'
        //   });
        //   const grammarResp = await smrClient.send(grammarCmd);
        //   const grammarPayload = JSON.parse(Buffer.from(grammarResp.Body!).toString());
        //   grammar = grammarPayload.corrections;
        // }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ transcript /*translation, grammar*/ }),
        };
    } catch (err: any) {
        console.error('Orchestrator error', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
}
