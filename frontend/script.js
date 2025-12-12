const API_BASE_URL = "http://localhost:5000"; 

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
  // Render markdown instead of plain text
  readmeContent.innerHTML = marked.parse(readmeText);
  readmeSection.classList.remove("hidden");
}

let currentCardIndex = 0;
let insightCards = [];
let isScrolling = false;
let previousCardIndex = -1;

function renderInsights(insightsText) {
  if (!insightsText) {
    insightsSection.classList.add("hidden");
    return;
  }
  // Split by markdown headings to create cards
  const parts = insightsText.split(/(^## .*$)/m).filter((p) => p.trim());
  insightsContent.innerHTML = "";
  insightCards = [];
  currentCardIndex = 0;
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith("##")) {
      let heading = parts[i].replace("##", "").trim();
      // Remove leading numbers and dots (e.g., "1. ", "2. ", "SECTION 1: ", etc.)
      heading = heading.replace(/^(SECTION\s+)?\d+[\.:]\s*/i, "").trim();
      const body = parts[i + 1] ? parts[i + 1].trim() : "";
      const card = document.createElement("div");
      card.className = "insight-card";
      card.innerHTML = `
        <h3>${heading}</h3>
        <div>${marked.parse(body)}</div>
      `;
      card.dataset.logicalIndex = insightCards.length;
      insightsContent.appendChild(card);
      insightCards.push(card);
      i++; // skip body
    }
  }
  
  // Initialize carousel
  if (insightCards.length > 0) {
    // Set up navigation first
    setupCarouselNavigation();
    setupCarouselIndicators();
    
    // Initialize with first card centered
    arrangeCardsCyclically(0);
    
    // Wait for DOM to update, then center the first card
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = insightsContent;
        const activeCard = insightCards[1] || insightCards[0]; // After rearrangement, active is at position 1
        if (activeCard) {
          const cardOffsetLeft = activeCard.offsetLeft;
          const cardWidth = activeCard.offsetWidth;
          const containerWidth = container.clientWidth;
          const targetScroll = cardOffsetLeft - (containerWidth / 2) + (cardWidth / 2);
          
          container.scrollTo({
            left: Math.max(0, targetScroll),
            behavior: "auto" // Instant for initial load
          });
          
          // Set active state
          insightCards.forEach((card, i) => {
            const cardLogicalIndex = parseInt(card.dataset.logicalIndex) || 0;
            if (cardLogicalIndex === 0) {
              card.classList.add("active");
            } else {
              card.classList.remove("active");
            }
          });
        }
      });
    });
  }
  
  insightsSection.classList.remove("hidden");
}

function arrangeCardsCyclically(activeIndex) {
  if (insightCards.length === 0) return;
  
  // Get all cards from DOM
  const allCards = Array.from(insightsContent.querySelectorAll('.insight-card'));
  
  // Create a map of logical index to card element
  const cardMap = new Map();
  allCards.forEach(card => {
    const logicalIdx = parseInt(card.dataset.logicalIndex) || 0;
    cardMap.set(logicalIdx, card);
  });
  
  // Create cyclic arrangement: [prev, active, next, ...rest]
  const orderedCards = [];
  const totalCards = allCards.length;
  
  // Add cards in cyclic order starting from the one before active
  for (let i = 0; i < totalCards; i++) {
    const logicalIndex = (activeIndex - 1 + i + totalCards) % totalCards;
    const card = cardMap.get(logicalIndex);
    if (card) {
      orderedCards.push(card);
    }
  }
  
  // Reorder DOM elements to create cyclic visual effect
  orderedCards.forEach((card) => {
    insightsContent.appendChild(card);
  });
  
  // Update the insightCards array to match new order
  insightCards = orderedCards;
}

function updateActiveCard(index) {
  if (insightCards.length === 0) return;
  
  // Handle circular navigation using logical indices
  const totalCards = insightCards.length;
  if (index < 0) {
    index = totalCards - 1;
  } else if (index >= totalCards) {
    index = 0;
  }
  
  const container = insightsContent;
  const currentScroll = container.scrollLeft;
  const cardWidth = 320 + 20; // card width + gap
  const containerWidth = container.clientWidth;
  
  // Determine direction BEFORE changing index
  const isMovingRight = (index > currentCardIndex && !(currentCardIndex === totalCards - 1 && index === 0)) || 
                        (currentCardIndex === totalCards - 1 && index === 0);
  const isMovingLeft = (index < currentCardIndex && !(currentCardIndex === 0 && index === totalCards - 1)) || 
                       (currentCardIndex === 0 && index === totalCards - 1);
  
  previousCardIndex = currentCardIndex;
  currentCardIndex = index;
  
  // Update card states first
  const allCards = Array.from(insightsContent.querySelectorAll('.insight-card'));
  allCards.forEach((card) => {
    const cardLogicalIndex = parseInt(card.dataset.logicalIndex) || 0;
    if (cardLogicalIndex === index) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
  
  // Rearrange cards in cyclic order
  arrangeCardsCyclically(index);
  
  // After rearrangement, active card is at position 1 (middle)
  const activeCard = insightCards[1];
  
  if (activeCard) {
    isScrolling = true;
    
    // Wait for DOM to update
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Re-get the active card after DOM update to ensure accurate position
        const updatedActiveCard = insightCards[1] || activeCard;
        const cardOffsetLeft = updatedActiveCard.offsetLeft;
        const cardActualWidth = updatedActiveCard.offsetWidth;
        
        // Always calculate target scroll to center the card precisely
        let targetScroll = cardOffsetLeft - (containerWidth / 2) + (cardActualWidth / 2);
        
        // For wrap-around, use calculated position directly
        const isWrapAround = (previousCardIndex === 0 && index === totalCards - 1) || 
                             (previousCardIndex === totalCards - 1 && index === 0);
        
        if (!isWrapAround) {
          // For normal navigation, verify direction but prioritize centering
          // Only adjust if the calculated center would move in the wrong direction
          if (isMovingRight && targetScroll < currentScroll) {
            // Moving right but calculated position is behind - this shouldn't happen after rearrangement
            // But if it does, ensure we move forward by at least one card width
            targetScroll = currentScroll + cardWidth;
          } else if (isMovingLeft && targetScroll > currentScroll) {
            // Moving left but calculated position is ahead - this shouldn't happen after rearrangement
            // But if it does, ensure we move backward by at least one card width
            targetScroll = currentScroll - cardWidth;
          }
          // Otherwise, trust the calculated center position
        }
        
        // Ensure scroll is within bounds
        const maxScroll = container.scrollWidth - containerWidth;
        targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));
        
        container.scrollTo({
          left: targetScroll,
          behavior: "smooth"
        });
        
        setTimeout(() => {
          isScrolling = false;
        }, 500);
      });
    });
  }
  
  updateNavigationButtons();
  updateIndicators();
}

function setupCarouselNavigation() {
  // Remove existing navigation if any
  const existingNav = insightsSection.querySelector(".carousel-nav");
  if (existingNav) {
    existingNav.remove();
  }
  
  // Create navigation buttons
  const nav = document.createElement("div");
  nav.className = "carousel-nav";
  nav.innerHTML = `
    <button class="carousel-btn" id="prevBtn" aria-label="Previous card">‹</button>
    <div class="carousel-indicator" id="carouselIndicators"></div>
    <button class="carousel-btn" id="nextBtn" aria-label="Next card">›</button>
  `;
  insightsSection.appendChild(nav);
  
  // Add event listeners
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  
  prevBtn.addEventListener("click", () => {
    updateActiveCard(currentCardIndex - 1);
  });
  
  nextBtn.addEventListener("click", () => {
    updateActiveCard(currentCardIndex + 1);
  });
  
  // Keyboard navigation (circular)
  document.addEventListener("keydown", (e) => {
    if (insightsSection.classList.contains("hidden")) return;
    
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      updateActiveCard(currentCardIndex - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      updateActiveCard(currentCardIndex + 1);
    }
  });
  
  // Card click to focus - use logical index
  insightCards.forEach((card) => {
    card.addEventListener("click", () => {
      const logicalIndex = parseInt(card.dataset.logicalIndex) || 0;
      updateActiveCard(logicalIndex);
    });
  });
  
  // Scroll snap detection with debouncing (only for manual scrolling)
  let scrollTimeout;
  insightsContent.addEventListener("scroll", () => {
    if (isScrolling) return; // Ignore programmatic scrolling
    
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (isScrolling) return; // Double check
      
      // Find which card is closest to center using logical indices
      const container = insightsContent;
      const containerCenter = container.scrollLeft + (container.clientWidth / 2);
      
      let closestCard = null;
      let closestDistance = Infinity;
      let closestLogicalIndex = -1;
      
      // Check all cards in DOM (they may be in cyclic order)
      const allCards = Array.from(insightsContent.querySelectorAll('.insight-card'));
      allCards.forEach((card) => {
        const logicalIndex = parseInt(card.dataset.logicalIndex) || 0;
        const cardCenter = card.offsetLeft + (card.offsetWidth / 2);
        const distance = Math.abs(containerCenter - cardCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestCard = card;
          closestLogicalIndex = logicalIndex;
        }
      });
      
      if (closestLogicalIndex !== -1 && closestLogicalIndex !== currentCardIndex) {
        updateActiveCard(closestLogicalIndex);
      }
    }, 150);
  });
}

function setupCarouselIndicators() {
  const indicatorsContainer = document.getElementById("carouselIndicators");
  if (!indicatorsContainer) return;
  
  indicatorsContainer.innerHTML = "";
  insightCards.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.className = "carousel-dot";
    if (index === 0) dot.classList.add("active");
    dot.addEventListener("click", () => {
      updateActiveCard(index);
    });
    indicatorsContainer.appendChild(dot);
  });
}

function updateIndicators() {
  const indicators = document.querySelectorAll(".carousel-dot");
  indicators.forEach((dot, index) => {
    if (index === currentCardIndex) {
      dot.classList.add("active");
    } else {
      dot.classList.remove("active");
    }
  });
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

