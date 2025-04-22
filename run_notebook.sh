#!/bin/bash
# This script is the "command" your Processing Job runs.

echo "Running papermill on notebook..."
papermill /opt/ml/processing/input/whisper_deploy.ipynb \
          /opt/ml/processing/output/my_notebook_out.ipynb

echo "Notebook execution done!"


