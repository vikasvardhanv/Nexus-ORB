# Streamlit Dockerfile for Nexus ARB
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (merged for efficiency)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    streamlit \
    alpaca-py \
    pandas \
    numpy \
    python-dotenv \
    plotly \
    requests

# Copy the entire PROJECT into /app because the app relies on execution/ scripts
COPY . /app/

# Create log directory
RUN mkdir -p /app/logs/arb && chmod 777 /app/logs/arb

# Streamlit-specific configuration
EXPOSE 8501

HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

# Use separate config to ensure Streamlit runs in dark mode and server settings
RUN mkdir -p ~/.streamlit && \
    echo "[theme]\nprimaryColor='#00FF00'\nbackgroundColor='#0E1117'\nsecondaryBackgroundColor='#1E2530'\ntextColor='#FFFFFF'\nfont='sans serif'\n\n[server]\nenableCORS=false\nenableXsrfProtection=false\nport=8501" > ~/.streamlit/config.toml

# Start the entrypoint
CMD ["streamlit", "run", "arb_deploy/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
