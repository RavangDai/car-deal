# 🚗 Car Deal Finder AI

Car Deal Finder AI is a full-stack application that identifies undervalued car listings using:
- 🔍 Web scraping (Craigslist, FB Marketplace, Autotrader…)
- 🤖 AI price prediction models
- 🧮 Deal scoring algorithms
- ⚡ FastAPI backend
- ⚛️ React + Vite frontend

---

## 📂 Project Structure

car-deal/
│
├── backend/ # FastAPI backend
│ ├── app/
│ │ ├── main.py
│ │ ├── models/
│ │ ├── routes/
│ │ └── services/
│ └── .venv/
│
├── frontend/ # React + Vite frontend
│ └── src/
│ ├── App.tsx
│ ├── components/
│ └── pages/
│
└── README.md

yaml
Copy code

---

## 🚀 Run Locally

### Backend
cd backend
..venv\Scripts\activate
python -m uvicorn app.main:app --reload

shell
Copy code

### Frontend
cd frontend
npm install
npm run dev

yaml
Copy code

---

## 🧠 Features (Coming Soon)

- Real-time scraping across car marketplaces  
- AI price estimation model  
- Automatic deal ranking  
- Alerts & notifications  
- Deployment (Railway + Vercel)

---

## 📘 Tech Stack

**Backend:** FastAPI, Uvicorn, Pydantic  
**Frontend:** React, Vite, TypeScript  
**AI/ML:** XGBoost / LightGBM / Scikit-Learn  
**Database:** PostgreSQL  
**Deployment:** Vercel + Railway  

---

Made with ❤️ by Bibek Pathak
