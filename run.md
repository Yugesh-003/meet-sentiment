1. Backend
   - Open a new terminal
   - cd backend
   - venv\Scripts\activate && uvicorn main:app --reload --port 8000
   - venv\Scripts\activate ; uvicorn main:app --reload --port 8000
   - Backend will start at http://localhost:8000

2. Frontend
   - Open a new terminal
   - cd frontend
   - npm run dev
   - Frontend will start at http://localhost:5173

3. Chrome Extension
   - Load extension at chrome://extensions
   - Enable "Developer mode"
   - Click "Load unpacked" and select extension folder
   - Extension icon should appear in browser toolbar