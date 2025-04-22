# Unilex Audio Transcription

This repo includes the jupyter notebook, python scripts, and terraform to deploy a openapi whisper endpoint for streaming 
audio transcription for the service unilex. It allows for multiple languages and is built off a CI/CD process using via 
opentofu and github actions. Neither opentofu nor terraform currnetly support direct creation/management of sagemaker notebooks,
so we used papermill to help run them via sagemaker processing jobs. This allows for a seemless deployment of new models and endpoints. 
The current sequence we used 

### Running Locally

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
   - The setup includes creation of:
     - IAM Roles
     - S3 Buckets and upload
     - Sagemaker process to deploy endpoint
     - 
## Whisper Endpoint Test Code
I found the whisper-inference-deploy.ipynb online and modified it to work in the current iteration of Sagemaker. I ran it and it works. Note that you have to copy the src/ directory into your sagemaker instance directory. I imagine you could add those files in code blocks in the jupyter notebook like the Lab 5 code did. You might also need to change the region when you retrieve the sagemaker image uri. Also, I ran the notebook on a ml.g4dn.large. Make sure you give it a good amount of storage when you boot up the notebook instance.
