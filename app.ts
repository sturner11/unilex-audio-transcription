import * as cdk from 'aws-cdk-lib';
import { UniLexWsEcsStack } from '../lib/ecs-ws-stack';

const app = new cdk.App();
new UniLexWsEcsStack(app, 'UniLexWsEcsStack', {
    /* optionally specify env: { account, region } */
});
