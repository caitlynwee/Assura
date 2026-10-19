FROM python:3.12-slim
WORKDIR /app

# System dependencies required by Playwright's Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libxshmfence1 libx11-6 libxext6 libxfixes3 libxi6 libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser binary
RUN playwright install chromium

# Source code (app/) and mock_brochure/ are volume-mounted at runtime
# so uvicorn --reload picks up changes without rebuilding the image.

EXPOSE 8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100", "--reload"]
