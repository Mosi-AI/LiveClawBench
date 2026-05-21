#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for microservice-stack-deploy"
echo "================================================="

# 1. Compile proto
echo "=== Compiling proto ==="
cd /workspace/services/kv-store
python3 -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. kvstore.proto

# 2. Start KV Store
echo "=== Starting KV Store ==="
python3 server.py &
sleep 2

# 3. Start API Server
echo "=== Starting API Server ==="
cd /workspace/services/api-server
export KV_STORE_HOST=localhost:50051
python3 app.py &
sleep 2

# 4. Configure Nginx
echo "=== Configuring Nginx ==="
cp /workspace/services/frontend/index.html /var/www/html/index.html

cat > /etc/nginx/sites-available/default << 'NGINXEOF'
server {
    listen 80 default_server;
    server_name _;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINXEOF

nginx -t && nginx
sleep 1

# 5. Verify
echo "=== Verifying ==="
curl -s http://localhost/ | head -5
curl -s -X POST http://localhost/api/set -H "Content-Type: application/json" -d '{"key":"demo","value":"hello-world"}'
echo ""
curl -s "http://localhost/api/get?key=demo"
echo ""
curl -s http://localhost/api/health
echo ""

echo "Reference solution complete."
