FROM python:3.12-slim
WORKDIR /app
COPY intelligence/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY intelligence/ .
COPY data/demo /data/demo
COPY data/eval/evaluation_results.json /data/eval/evaluation_results.json
ENV DEMO_DIR=/data/demo
USER 10001
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
