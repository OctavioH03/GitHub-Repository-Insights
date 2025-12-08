# GitHub Repo Insight Cards

Quickly understand any GitHub repository or find one that matches a natural-language need. The app fetches repo data from GitHub and uses OpenAI to generate concise Insight Cards.

## Overview
**Frontend (static, GitHub Pages ready)**  
- Simple HTML/CSS/JS.  
- Modes:  
  - Analyze Repo URL  
  - Search by description (natural language).  
- Displays repo metadata, README snippet, and AI-generated Insight Cards.

**Backend (Flask API)**  
- Endpoint: `POST /api/insights`  
- queryType = `url`: parse owner/repo from the URL and fetch GitHub data.  
- queryType = `search`: convert natural language to GitHub search keywords (OpenAI), pick the top repo from GitHub Search, then fetch details.  
- Calls OpenAI (`gpt-4.1-mini`) to generate Insight Cards:
  1. What the repository does  
  2. Tech stack overview  
  3. Risks, limitations, TODOs  
  4. Quick start steps  
  5. (Optional) Similar project themes

## Architecture
Frontend → Backend → GitHub API & OpenAI API

- Frontend: `fetch()` → `POST /api/insights`  
- Backend: orchestrates GitHub REST + OpenAI chat.  
- Data returned: `{ repo: {...}, insights: "<markdown text>" }`

## Project Structure
```
.
├── server/
│   ├── app.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .gitignore
└── README.md
```

## Backend Setup (local)
```bash
cd server
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
export OPENAI_API_KEY=your_openai_key
# Optional, for higher GitHub rate limits:
# export GITHUB_TOKEN=your_github_pat

python app.py
# Backend runs on http://localhost:5000
```

## Frontend (local)
Open `frontend/index.html` directly in the browser, or serve it:
```bash
cd frontend
python -m http.server 8000
# Visit http://localhost:8000
```
Make sure the backend is running on `http://localhost:5000` (update `API_BASE_URL` in `script.js` if you deploy the backend elsewhere).

## Deploying Frontend (GitHub Pages)
- Push the repo to GitHub.
- In Pages settings, point to the `frontend/` folder (or move files to root of a `gh-pages` branch).
- Update `API_BASE_URL` in `frontend/script.js` to your deployed backend URL.

## Deploying Backend (Render/Railway/others)
- Set env vars: `OPENAI_API_KEY`, optional `GITHUB_TOKEN`.
- Expose `POST /api/insights`.
- Enable CORS (already enabled in `app.py`).

## API Contract
`POST /api/insights`
```json
// URL mode
{ "queryType": "url", "value": "https://github.com/pallets/flask" }

// Search mode
{ "queryType": "search", "value": "a TypeScript socket.io boilerplate" }
```

Response
```json
{
  "repo": {
    "name": "...",
    "full_name": "...",
    "description": "...",
    "languages": { "Python": 12345 },
    "topics": ["flask", "werkzeug"],
    "readme": "...",
    "html_url": "https://github.com/..."
  },
  "insights": "## Section 1 ... (markdown)"
}
```

## Rate Limits & Notes
- GitHub unauthenticated: ~60 req/hr. With `GITHUB_TOKEN`, much higher.
- OpenAI: billed per request; this app uses `gpt-4.1-mini` for text only.
- README is truncated (~4KB) to keep prompts short and fast.

## Screenshot Placeholder
Add a screenshot here of the frontend showing repo info and insight cards.


