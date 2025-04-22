FROM python:3.8-slim

ENV AWS_DEFAULT_REGION=us-east-1
ENV AWS_REGION=us-east-1


COPY code /opt/var
COPY ./requirements.txt  .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Register the default Python kernel under the name "python3"
RUN python -m ipykernel install --user --name python3 --display-name "Python 3"


# Copy your entrypoint script and other assets as needed
COPY run_notebook.sh /opt/ml/run_notebook.sh
RUN chmod +x /opt/ml/run_notebook.sh

ENTRYPOINT ["/opt/ml/run_notebook.sh"]