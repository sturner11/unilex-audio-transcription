1. Setup Infrastructure
 - get test user and creds from account
 - install aws client
    ```
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
    sudo installer -pkg AWSCLIV2.pkg -target / 
   ```
 - Run ```aws configure``` using the Access Key ID found in IAM under users and security configuration
   - User must be given the correct IAM roles to do tofu actions
 - Set up s3 Bucket to be used for tofu configuration and set up file directory
 - install opentofu with ```brew install opentofu``` (verify installation with ```tofu --version```)
2. Terraform files
 - Configure vars
 - Run in the setup files for each stage run ```tofu init``` followed by ```tofu plan``` and ```tofu apply``` to create the needed setup before deploy
 - Run the same commands in the app files
 - AWS instances needed:
   - IAM Roles?
   - VPC
   - Lambda to deploy endopint
   - Route53?
   - AWS Kinesis?
   - S3 bucket to store logs?
3. GHA Actions
 - GHA Command to convert .ipnyb to script: ```jupyter nbconvert --to script whisper-inference-deploy.ipynb```
 - Log into AWS
 - Check tf plan
 - Run tf app files for corresponding environment
