#!/bin/bash

echo "☕ Memulai KopiPOS..."

# Stop any running processes on our ports
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "--> Menjalankan Backend API (Port 8000)"
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Detect local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo "--> Menjalankan Frontend (Port 5173)"
cd frontend
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
VITE_API_BASE="http://$LOCAL_IP:8000/api" npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
cd ..

echo "✅ KopiPOS berhasil dijalankan!"
echo "   - Frontend (lokal)   : http://localhost:5173"
echo "   - Frontend (jaringan): http://$LOCAL_IP:5173"
echo "   - API Docs            : http://localhost:8000/docs"
echo "   - API (jaringan)     : http://$LOCAL_IP:8000/docs"
echo ""
echo "Tekan CTRL+C untuk menghentikan server."

# Wait for both processes to finish
wait $BACKEND_PID $FRONTEND_PID
