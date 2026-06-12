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

## 🔐 Authentication & OAuth setup

Auth supports **email/password** *and* **Google / GitHub social login**. The
session JWT is stored in a **Secure, httpOnly cookie** (not `localStorage`), with
CSRF double-submit protection. Social login stays dormant until you add provider
credentials — the buttons return a friendly error otherwise.

### 1. Register the OAuth apps

**Google** — [Google Cloud Console](https://console.cloud.google.com/) → *APIs &
Services* → *Credentials* → *Create Credentials* → *OAuth client ID* → **Web
application**. Add authorized redirect URI:

```
http://localhost:8000/auth/oauth/google/callback
```

**GitHub** — *Settings* → *Developer settings* → *OAuth Apps* → *New OAuth App*.
Set the **Authorization callback URL**:

```
http://localhost:8000/auth/oauth/github/callback
```

(For production add your deployed backend's `/auth/oauth/<provider>/callback` URL too.)

### 2. Add credentials to `.env` (repo root)

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Public base URL of the backend (used to build OAuth callback URLs)
OAUTH_REDIRECT_BASE=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# Session cookie — dev defaults shown.
# In production (frontend and backend on different sites) set:
#   COOKIE_SECURE=true
#   COOKIE_SAMESITE=none
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# Strongly recommended: a long random JWT signing key
SECRET_KEY=replace-with-a-long-random-string
```

### 3. Run the stack

```bash
docker compose up --build      # applies migration 003 automatically
cd frontend && npm run dev
```

Click **Continue with Google / GitHub** on the login page → consent → you land in
the dashboard with an httpOnly session cookie. Email/password still works and now
sets the same cookie.

### Backend tests

```bash
cd backend
.venv\Scripts\activate
pip install -r requirements-dev.txt
pytest                          # offline scraper + OAuth/cookie tests
```

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
