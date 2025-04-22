# Unilex Audio Transcription

This repo includes the jupyter notebook, python scripts, and terraform to deploy a openapi whisper endpoint for streaming 
audio transcription for the service unilex. It allows for multiple languages and is built off a CI/CD process using via 
opentofu and github actions. Neither opentofu nor terraform currnetly support direct creation/management of sagemaker notebooks,
so we used papermill to help run them via sagemaker processing jobs. This allows for a seemless deployment of new models and endpoints. 
Additionally ```./whisper-training``` has the jupyter notebook that could be used for fine tuning the model based on specific data


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

2. Jupyter Notebook
- The jupyter notebook is prepped to run directly with correct aws permissions.
- Can be run locally, or added to a jupyter notebook in your chosen space

2. Terraform files
 - Configure vars
 - Run in the setup files for each stage run ```tofu init``` followed by ```tofu plan``` and ```tofu apply``` to create the needed setup before deploy
 - Run the same commands in the app files
 - AWS instances needed:
   - The setup includes creation of:
     - IAM Roles
     - S3 Buckets and upload
     - Sagemaker process to deploy endpoint