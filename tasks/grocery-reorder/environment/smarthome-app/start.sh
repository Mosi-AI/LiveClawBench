#!/bin/bash

echo "=========================================="
echo "  Smart Home Mock - Quick Start"
echo "=========================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python3 not found"
    exit 1
fi

echo "Python version: $(python3 --version)"

cd backend

# Install dependencies
echo ""
echo "Checking dependencies..."
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "Installing dependencies..."
    pip3 install -q -r requirements.txt
    if [ $? -eq 0 ]; then
        echo "Dependencies installed"
    else
        echo "Failed to install dependencies"
        exit 1
    fi
else
    echo "Dependencies already installed"
fi

echo ""
echo "=========================================="
echo "  Starting Smart Home Mock Service"
echo "=========================================="
echo ""
echo "API endpoints:"
echo "  • Health:     http://localhost:5003/health"
echo "  • Thermostat: http://localhost:5003/api/thermostat"
echo "  • Inventory:  http://localhost:5003/api/inventory"
echo "  • Grocery:    http://localhost:5003/api/grocery/products"
echo ""
echo "Press Ctrl+C to stop"
echo "=========================================="
echo ""

# Start service
python3 app.py
