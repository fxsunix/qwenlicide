/**
 * Qwenlicide Prompt Generator
 * Pipeline: fetch prompt.md > regex > final guard result + token stats
 */

// Guard mapping: maps each data-guard attribute to a regex matching its section header
const GUARD_RULES = [
  { guard: "ooc", regex: /^<OOC_COMMAND/i },
  { guard: "voice", regex: /^◇\s*Voice/i },
  { guard: "formatting", regex: /^◇\s*Formatting/i },
  { guard: "operator", regex: /^◇\s*Operator/i },
  { guard: "character", regex: /^◇\s*Character/i },
  { guard: "continuity", regex: /^◇\s*(?:Consequence|Continuity|Combat)/i },
  { guard: "knowledge", regex: /^◇\s*Knowledge/i },
  { guard: "relationships", regex: /^◇\s*Relationships/i },
  { guard: "physical", regex: /^◇\s*Physical/i },
  { guard: "pacing", regex: /^◇\s*Pacing/i },
  { guard: "prose", regex: /^◇\s*Prose/i },
  { guard: "mature", regex: /^◇\s*Mature/i },
  { guard: "antislop", regex: /^◇\s*Anti-Slop/i },
  { guard: "checklist", regex: /^◇\s*(?:Before You Send It|Checklist)/i },
];

let rawPrompt = "";

/**
 * Estimate tokens based on combined BPE heuristic (chars & words)
 */
function estimateTokens(text) {
  if (!text || !text.trim()) return 0;
  const chars = text.length;
  const words = text.trim().split(/\s+/).length;
  return Math.round((chars / 4.15 + words * 1.28) / 2);
}

/**
 * Update token, word, and character counters
 */
function updateStats(text) {
  const tokenElem = document.getElementById("tokenCount");
  const wordElem = document.getElementById("wordCount");
  const charElem = document.getElementById("charCount");

  const tokens = estimateTokens(text);
  const words = text && text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text ? text.length : 0;

  if (tokenElem) tokenElem.textContent = `~${tokens.toLocaleString()}`;
  if (wordElem) wordElem.textContent = words.toLocaleString();
  if (charElem) charElem.textContent = chars.toLocaleString();
}

/**
 * Update label visual states for active/inactive contrast
 */
function updateToggleVisuals() {
  document.querySelectorAll(".guard-toggle").forEach(cb => {
    const label = cb.closest("label");
    if (label) {
      if (cb.checked) {
        label.classList.add("is-checked");
        label.classList.remove("is-unchecked");
      } else {
        label.classList.remove("is-checked");
        label.classList.add("is-unchecked");
      }
    }
  });
}

/**
 * 1. FETCH prompt.md
 */
async function loadPrompt() {
  try {
    const res = await fetch("./assets/prompt.md", { cache: "no-cache" });
    if (res.ok) {
      rawPrompt = await res.text();
    }
  } catch (err) {
    // Fallback if fetch is blocked (e.g. file:// protocol or offline)
    const textarea = document.getElementById("promptOutput");
    if (textarea && textarea.value) {
      rawPrompt = textarea.value;
    }
  }

  // If still empty, read from textarea
  if (!rawPrompt) {
    const textarea = document.getElementById("promptOutput");
    if (textarea && textarea.value) {
      rawPrompt = textarea.value;
    }
  }

  updateGuardResult();
}

/**
 * 2. REGEX > 3. FINAL GUARD RESULT
 */
function updateGuardResult() {
  updateToggleVisuals();

  if (!rawPrompt) return;

  const outputElem = document.getElementById("promptOutput");
  if (!outputElem) return;

  // Collect active checkbox guard keys
  const activeGuards = new Set();
  document.querySelectorAll(".guard-toggle:checked").forEach(cb => {
    activeGuards.add(cb.dataset.guard);
  });

  // Regex split: separate prompt by section headers starting with ◇ or <OOC_COMMAND
  const sections = rawPrompt.split(/(?=\r?\n(?:◇ |<OOC_COMMAND))/i).map(s => s.trim()).filter(Boolean);

  // Filter sections by active guard toggles
  const finalSections = sections.filter(section => {
    const header = section.split("\n")[0];
    const rule = GUARD_RULES.find(r => r.regex.test(header));

    // If section matches a guard rule, include only if checked;
    // otherwise it is a core/base engine section, always include.
    if (rule) {
      return activeGuards.has(rule.guard);
    }
    return true;
  });

  // Final guard result
  const finalPrompt = finalSections.join("\n\n");
  outputElem.value = finalPrompt;

  // Update stats
  updateStats(finalPrompt);
}

/**
 * Copy to clipboard with cute feedback
 */
async function handleCopy() {
  const outputElem = document.getElementById("promptOutput");
  const copyBtn = document.getElementById("copyBtn");
  if (!outputElem || !copyBtn) return;

  const textToCopy = outputElem.value;
  const originalText = "Copy Prompt";

  let copied = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      copied = true;
    } catch (e) {
      // Fallback below
    }
  }

  if (!copied) {
    try {
      outputElem.focus();
      outputElem.select();
      outputElem.setSelectionRange(0, 999999);
      copied = document.execCommand("copy");
    } catch (e) {
      copied = false;
    }
  }

  if (copied) {
    copyBtn.classList.add("copied");
    copyBtn.textContent = "Copied! (✿´ ꒳ ` ) ♡";
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove("copied");
    }, 2000);
  } else {
    copyBtn.textContent = "Selected! Press Ctrl+C (⇀‸↼‶)";
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2500);
  }
}

/**
 * Tab switching logic
 */
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("aria-controls");

      tabButtons.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });

      tabContents.forEach(content => {
        content.classList.remove("active");
        content.hidden = true;
      });

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
        targetContent.hidden = false;
      }
    });
  });
}

/**
 * Initialize event listeners and fetch prompt
 */
function init() {
  // Listen for checkbox changes
  document.querySelectorAll(".guard-toggle").forEach(toggle => {
    toggle.addEventListener("change", updateGuardResult);
  });

  // Copy button
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", handleCopy);
  }

  // Bulk actions inside Guards tab
  const selectAllBtn = document.getElementById("selectAllBtn");
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      const tabGuards = document.getElementById("tab-guards");
      const toggles = tabGuards ? tabGuards.querySelectorAll(".guard-toggle") : document.querySelectorAll(".guard-toggle");
      toggles.forEach(cb => { cb.checked = true; });
      updateGuardResult();
    });
  }

  const deselectAllBtn = document.getElementById("deselectAllBtn");
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener("click", () => {
      const tabGuards = document.getElementById("tab-guards");
      const toggles = tabGuards ? tabGuards.querySelectorAll(".guard-toggle") : document.querySelectorAll(".guard-toggle");
      toggles.forEach(cb => { cb.checked = false; });
      updateGuardResult();
    });
  }

  // Initialize tabs
  initTabs();

  // Initial visual update
  updateToggleVisuals();

  // Fetch prompt.md and compute result
  loadPrompt();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
