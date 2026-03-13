function setupRating() {
  const group = document.getElementById("recommend-rating");
  const hidden = document.getElementById("rating-value");
  if (!group || !hidden) return;

  group.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const value = target.dataset.value;
    if (!value) return;

    group
      .querySelectorAll(".rating-option.selected")
      .forEach((el) => el.classList.remove("selected"));
    target.classList.add("selected");
    hidden.value = value;
  });
}

function setupFeedbackSubmit() {
  const forms = document.querySelectorAll("form[data-api='feedback']");
  forms.forEach((form) => {
    const message = form.querySelector(".form-message");
    const submitButton = form.querySelector("button[type='submit']");
    const source = form.getAttribute("data-source") || "listener";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (message) message.textContent = "";
      if (submitButton) submitButton.disabled = true;

      try {
        const formData = new FormData(form);
        formData.set("source", source);
        const response = await fetch("/api/feedback", {
          method: "POST",
          body: formData,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.ok) {
          if (message) {
            message.textContent = data.message || "提交失败，请稍后再试。";
          }
          return;
        }

        form.reset();
        form
          .querySelectorAll(".rating-option.selected")
          .forEach((el) => el.classList.remove("selected"));
        if (message) {
          message.textContent = "感谢您的反馈，我们已实时收到。";
        }
      } catch (error) {
        if (message) {
          message.textContent = "网络连接异常，请稍后再试。";
        }
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupRating();
  setupFeedbackSubmit();
});
