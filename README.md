# unilex-audio-transcription

## Whisper Endpoint Test Code
I found the whisper-inference-deploy.ipynb online and modified it to work in the current iteration of Sagemaker. I ran it and it works. Note that you have to copy the src/ directory into your sagemaker instance directory. I imagine you could add those files in code blocks in the jupyter notebook like the Lab 5 code did. You might also need to change the region when you retrieve the sagemaker image uri. Also, I ran the notebook on a ml.g4dn.large. Make sure you give it a good amount of storage when you boot up the notebook instance.
