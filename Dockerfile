# Use an official lightweight Python image as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies needed for libraries like pandas/kaggle
RUN apt-get update && apt-get install -y \
    build-essential \
    default-libmysqlclient-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file and install dependencies
# This step is cached if requirements.txt doesn't change
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application code to the container
# This includes app.py, analyzer.py, config.py, i_to_rec3.py, etc.
COPY . /app

# Expose the port the app will run on
# Cloud Run automatically injects the $PORT environment variable
ENV PORT 8080

# The command to run the application using Gunicorn.
# Gunicorn is a production-ready HTTP server for Python web apps.
# Use a sensible number of workers, e.g., 2 workers plus the master process.
CMD exec gunicorn --bind :$PORT --workers 2 app:app