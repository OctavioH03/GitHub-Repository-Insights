"""
GitHub Repo Insight Cards - Flask Backend

Endpoint: POST /api/insights
Input:
  Case A (URL):
    { "queryType": "url", "value": "https://github.com/owner/repo" }
  Case B (Search):
    { "queryType": "search", "value": "natural language description" }

Behavior:
  - If URL: parse owner/repo, fetch metadata, README, languages, topics.
  - If search: ask OpenAI to produce GitHub search keywords, use GitHub search API
    to pick top repo, then fetch metadata, README, languages, topics.
  - Send gathered repo data to OpenAI to generate Insight Cards:
      1) What the repository does
      2) Tech stack overview
      3) Risks/limitations/TODOs
      4) Quick start steps
      5) (optional) Similar project themes
Output:
  {
    "repo": { ...github info..., "readme": "<decoded snippet>" },
    "insights": "<AI text>"
  }
"""

import base64
import logging
import os
from urllib.parse import urlparse

from dotenv import load_dotenv
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import OpenAI

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Logging
logging.basicConfig(level=logging.INFO)

# OpenAI client
def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    return OpenAI(api_key=api_key)


# GitHub helpers
GITHUB_API_BASE = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # optional but recommended for higher rate limits


def gh_headers():
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "repo-insights-app",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


def parse_repo_url(url: str):
    try:
        parsed = urlparse(url)
        parts = parsed.path.strip("/").split("/")
        if len(parts) >= 2:
            return parts[0], parts[1]
    except Exception:
        return None, None
    return None, None


def fetch_repo(owner: str, repo: str):
    resp = requests.get(f"{GITHUB_API_BASE}/repos/{owner}/{repo}", headers=gh_headers(), timeout=10)
    if resp.status_code == 404:
        return None, 404
    resp.raise_for_status()
    return resp.json(), resp.status_code


def fetch_readme(owner: str, repo: str, max_chars: int = 4000):
    resp = requests.get(
        f"{GITHUB_API_BASE}/repos/{owner}/{repo}/readme",
        headers=gh_headers(),
        timeout=10,
    )
    if resp.status_code == 404:
        return ""
    resp.raise_for_status()
    data = resp.json()
    content = data.get("content", "")
    encoding = data.get("encoding", "base64")
    if encoding == "base64":
        try:
            decoded = base64.b64decode(content).decode("utf-8", errors="ignore")
            return decoded[:max_chars]
        except Exception:
            return ""
    return content[:max_chars] if isinstance(content, str) else ""


def fetch_languages(owner: str, repo: str):
    resp = requests.get(f"{GITHUB_API_BASE}/repos/{owner}/{repo}/languages", headers=gh_headers(), timeout=10)
    if resp.status_code != 200:
        return {}
    return resp.json() or {}


def fetch_topics(owner: str, repo: str):
    resp = requests.get(
        f"{GITHUB_API_BASE}/repos/{owner}/{repo}/topics",
        headers={**gh_headers(), "Accept": "application/vnd.github.mercy-preview+json"},
        timeout=10,
    )
    if resp.status_code != 200:
        return []
    data = resp.json() or {}
    return data.get("names", []) or data.get("topics", []) or []


def search_repos(query: str, limit: int = 1):
    resp = requests.get(
        f"{GITHUB_API_BASE}/search/repositories",
        params={"q": query, "sort": "stars", "order": "desc", "per_page": limit},
        headers=gh_headers(),
        timeout=10,
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return items


def repo_bundle(owner: str, repo: str):
    repo_data, status = fetch_repo(owner, repo)
    if repo_data is None:
        return None, status
    readme = fetch_readme(owner, repo)
    languages = fetch_languages(owner, repo)
    topics = fetch_topics(owner, repo)
    bundle = {
        "name": repo_data.get("name"),
        "full_name": repo_data.get("full_name"),
        "description": repo_data.get("description"),
        "html_url": repo_data.get("html_url"),
        "stargazers_count": repo_data.get("stargazers_count"),
        "forks_count": repo_data.get("forks_count"),
        "open_issues_count": repo_data.get("open_issues_count"),
        "license": repo_data.get("license", {}).get("name") if repo_data.get("license") else None,
        "languages": languages,
        "topics": topics,
        "readme": readme,
    }
    return bundle, 200


# OpenAI prompts
def keywords_from_nl(query: str) -> str:
    client = get_openai_client()
    prompt = f"""
You turn natural language repo needs into concise GitHub search keywords.
User need: \"{query}\"
Return only a short keyword string suitable for GitHub search (no JSON, no quotes).
"""
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=40,
        temperature=0.2,
    )
    return resp.choices[0].message.content.strip()


def generate_insights(repo_json: dict) -> str:
    client = get_openai_client()
    prompt = f"""
You are an AI that produces 4–5 Insight Cards for software repositories.
Based ONLY on the data below, produce clear sections with markdown headings.

SECTION 1: What the repository does
SECTION 2: Tech stack overview
SECTION 3: Risks, limitations, TODOs
SECTION 4: Quick start steps
SECTION 5 (optional): Similar project themes

REPOSITORY DATA:
{repo_json}
"""
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=600,
    )
    return resp.choices[0].message.content


@app.route("/api/insights", methods=["POST"])
def insights():
    try:
        payload = request.get_json() or {}
        query_type = payload.get("queryType")
        value = (payload.get("value") or "").strip()
        if not query_type or not value:
            return jsonify({"error": "queryType and value are required"}), 400

        repo_info = None

        if query_type == "url":
            owner, repo = parse_repo_url(value)
            if not owner or not repo:
                return jsonify({"error": "Invalid GitHub URL"}), 400
            repo_info, status = repo_bundle(owner, repo)
            if status == 404 or repo_info is None:
                return jsonify({"error": "Repo not found"}), 404

        elif query_type == "search":
            # Turn NL into keywords
            keywords = keywords_from_nl(value)
            logging.info(f"Search keywords: {keywords}")
            results = search_repos(keywords, limit=1)
            if not results:
                return jsonify({"error": "No repository found for that query"}), 404
            top = results[0]
            owner = top["owner"]["login"]
            repo = top["name"]
            repo_info, status = repo_bundle(owner, repo)
            if status == 404 or repo_info is None:
                return jsonify({"error": "Repo not found"}), 404
        else:
            return jsonify({"error": "queryType must be 'url' or 'search'"}), 400

        # Generate Insight Cards
        insights_text = generate_insights(repo_info)

        return jsonify({"repo": repo_info, "insights": insights_text})

    except requests.exceptions.RequestException as e:
        logging.exception("GitHub API error")
        return jsonify({"error": "Failed to fetch data from GitHub"}), 502
    except Exception as e:
        logging.exception("Server error")
        return jsonify({"error": "Server error"}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        logging.warning("OPENAI_API_KEY is not set; OpenAI calls will fail.")
    app.run(debug=True, host="0.0.0.0", port=5000)

