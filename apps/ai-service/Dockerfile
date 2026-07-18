FROM python:3.12-slim
WORKDIR /app
COPY apps/ai-service/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY apps/ai-service /app/apps/ai-service
COPY domains /app/domains
ENV PYTHONPATH=/app/apps/ai-service
CMD ["uvicorn", "app.main:app", "--app-dir", "apps/ai-service", "--host", "0.0.0.0", "--port", "8001"]
