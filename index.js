const cursor = document.getElementById("custom-cursor");
const cursorText = document.getElementById("custom-cursor-text");
const panelToggles = document.querySelectorAll("[data-panel-target]");
const panels = document.querySelectorAll(".overlay-panel");

function setCursorText(text) {
  if (!cursorText) return;
  cursorText.textContent = text || "bingo studio";
}

function closePanels() {
  panels.forEach((panel) => {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  });
}

function togglePanel(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const isOpen = target.classList.contains("is-open");
  closePanels();

  if (!isOpen) {
    target.classList.add("is-open");
    target.setAttribute("aria-hidden", "false");
  }
}

document.addEventListener("mousemove", (event) => {
  if (!cursor) return;

  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
  cursor.classList.add("is-visible");
});

document.addEventListener("mouseleave", () => {
  if (!cursor) return;
  cursor.classList.remove("is-visible");
});

document.querySelectorAll("[data-cursor]").forEach((element) => {
  element.addEventListener("mouseenter", () => {
    setCursorText(element.getAttribute("data-cursor"));
  });

  element.addEventListener("mouseleave", () => {
    setCursorText("bingo studio");
  });
});

panelToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    togglePanel(toggle.getAttribute("data-panel-target"));
  });
});

panels.forEach((panel) => {
  panel.addEventListener("click", (event) => {
    if (event.target === panel) {
      closePanels();
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePanels();
  }
});
