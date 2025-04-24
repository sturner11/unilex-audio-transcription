import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Duration } from 'aws-cdk-lib';

export class UniLexWsEcsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // VPC
        const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });

        // ECS Cluster
        const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

        // Docker image asset
        const imageAsset = new assets.DockerImageAsset(this, 'WsServerImage', {
            directory: '.',
        });

        // Task definition
        const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
            cpu: 512,
            memoryLimitMiB: 1024,
        });

        const container = taskDef.addContainer('WsContainer', {
            image: ecs.ContainerImage.fromDockerImageAsset(imageAsset),
            logging: ecs.LogDriver.awsLogs({ streamPrefix: 'ws-server' }),
            environment: {
                RESPONSE_STREAM_NAME: process.env.RESPONSE_STREAM_NAME || '',
                AWS_REGION: this.region,
            },
        });
        container.addPortMappings({ containerPort: 8080 });

        // Fargate service
        const service = new ecs.FargateService(this, 'Service', {
            cluster,
            taskDefinition: taskDef,
            desiredCount: 1,
        });

        // ALB
        const lb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
            vpc,
            internetFacing: true,
        });
        const listener = lb.addListener('Listener', { port: 80, open: true });
        listener.addTargets('ECS', {
            port: 80,
            targets: [service],
            healthCheck: {
                interval: Duration.seconds(30),
                path: '/',
                healthyHttpCodes: '200,404',
            },
        });

        // Allow ALB to talk to service
        service.connections.allowFrom(lb, ec2.Port.tcp(8080));
    }
}
