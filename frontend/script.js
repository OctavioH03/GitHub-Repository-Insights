const API_BASE_URL = "http://localhost:5000"; // change to deployed backend when needed

const inputValue = document.getElementById("inputValue");
const inputLabel = document.getElementById("inputLabel");
const modeRadios = document.querySelectorAll('input[name="mode"]');
const submitButton = document.getElementById("submitButton");
const statusDiv = document.getElementById("status");

const repoInfoSection = document.getElementById("repoInfo");
const repoMetaDiv = document.getElementById("repoMeta");
const repoLangDiv = document.getElementById("repoLanguages");
const repoTopicsDiv = document.getElementById("repoTopics");

const readmeSection = document.getElementById("readmeSection");
const readmeContent = document.getElementById("readmeContent");

const insightsSection = document.getElementById("insightsSection");
const insightsContent = document.getElementById("insightsContent");

function setStatus(msg, type = "info") {
  statusDiv.textContent = msg;
  statusDiv.className = `status-message ${type}`;
}

function clearStatus() {
  statusDiv.textContent = "";
  statusDiv.className = "status-message";
}

function toggleMode() {
  const selected = document.querySelector('input[name="mode"]:checked')?.value;
  if (selected === "search") {
    inputLabel.textContent = "Describe the repo you need";
    inputValue.placeholder = "e.g., a TypeScript socket.io boilerplate";
  } else {
    inputLabel.textContent = "GitHub Repo URL";
    inputValue.placeholder = "e.g., https://github.com/pallets/flask";
  }
}

modeRadios.forEach((r) => r.addEventListener("change", toggleMode));

function renderRepo(repo) {
  if (!repo) return;
  repoMetaDiv.innerHTML = `
    <div><strong>Name:</strong> ${repo.full_name || repo.name}</div>
    <div><strong>Description:</strong> ${repo.description || "N/A"}</div>
    <div><strong>Stars:</strong> ${repo.stargazers_count ?? "N/A"} | <strong>Forks:</strong> ${repo.forks_count ?? "N/A"} | <strong>Issues:</strong> ${repo.open_issues_count ?? "N/A"}</div>
    <div><strong>URL:</strong> <a href="${repo.html_url}" target="_blank">${repo.html_url}</a></div>
    <div><strong>License:</strong> ${repo.license || "N/A"}</div>
  `;

  // Languages
  repoLangDiv.innerHTML = "";
  if (repo.languages && Object.keys(repo.languages).length > 0) {
    Object.entries(repo.languages).forEach(([lang, bytes]) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = `${lang} (${bytes} bytes)`;
      repoLangDiv.appendChild(pill);
    });
  }

  // Topics
  repoTopicsDiv.innerHTML = "";
  if (repo.topics && repo.topics.length > 0) {
    repo.topics.forEach((t) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = t;
      repoTopicsDiv.appendChild(pill);
    });
  }

  repoInfoSection.classList.remove("hidden");
}

function renderReadme(readmeText) {
  if (!readmeText) {
    readmeSection.classList.add("hidden");
    return;
  }
  readmeContent.textContent = readmeText;
  readmeSection.classList.remove("hidden");
}

function renderInsights(insightsText) {
  if (!insightsText) {
    insightsSection.classList.add("hidden");
    return;
  }
  // Split by markdown headings to create cards
  const parts = insightsText.split(/(^## .*$)/m).filter((p) => p.trim());
  insightsContent.innerHTML = "";
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith("##")) {
      const heading = parts[i].replace("##", "").trim();
      const body = parts[i + 1] ? parts[i + 1].trim() : "";
      const card = document.createElement("div");
      card.className = "insight-card";
      card.innerHTML = `
        <h3>${heading}</h3>
        <div>${marked.parse(body)}</div>
      `;
      insightsContent.appendChild(card);
      i++; // skip body
    }
  }
  insightsSection.classList.remove("hidden");
}

async function handleSubmit() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || "url";
  const value = inputValue.value.trim();

  if (!value) {
    setStatus("Please enter a value.", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus("Working...", "info");

  try {
    const payload = { queryType: mode, value };
    const resp = await fetch(`${API_BASE_URL}/api/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Request failed: ${resp.status}`);
    }

    const data = await resp.json();
    renderRepo(data.repo);
    renderReadme(data.repo?.readme);
    renderInsights(data.insights);
    setStatus("Done!", "success");
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Something went wrong", "error");
  } finally {
    submitButton.disabled = false;
  }
}

submitButton.addEventListener("click", handleSubmit);
inputValue.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSubmit();
});

// Init
toggleMode();

