const TIME_SLOTS = [
  { id: "13:30-15:00", label: "13:30 – 15:00" },
  { id: "15:30-17:00", label: "15:30 – 17:00" },
  { id: "17:00-18:30", label: "17:00 – 18:30" },
];

const UNAVAILABLE_MESSAGE = "该时间段已被预约，请选择另外合适的时间。";
const ERROR_FIELD_CLASS = "field-error";
const ERROR_GROUP_CLASS = "field-error-group";
const ERROR_BOX_CLASS = "field-error-box";

function escapeAttr(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getTomorrowISODate() {
  const today = new Date();
  const tomorrow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchDateAvailability(date) {
  const response = await fetch(`/api/bookings/availability?date=${encodeURIComponent(date)}`);
  if (!response.ok) {
    return { available: true, message: "" };
  }
  return response.json();
}

function renderTimeSlots(date, options = {}) {
  const container = document.getElementById("time-slots");
  const hiddenInput = document.getElementById("time");
  const unavailableMessage = document.getElementById("booking-unavailable-message");
  if (!container || !hiddenInput) return;

  const dateUnavailable = Boolean(options.dateUnavailable);
  const selectedTimeId = options.selectedTimeId || "";
  container.innerHTML = "";
  hiddenInput.value = "";

  if (unavailableMessage) {
    unavailableMessage.textContent = dateUnavailable ? UNAVAILABLE_MESSAGE : "";
  }

  TIME_SLOTS.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = slot.label;
    button.className = "time-slot";
    button.dataset.id = slot.id;

    const isDisabled = !date || dateUnavailable;
    if (isDisabled) {
      button.classList.add("disabled");
      button.disabled = true;
    }

    if (!isDisabled && selectedTimeId && selectedTimeId === slot.id) {
      button.classList.add("selected");
      hiddenInput.value = slot.id;
    }

    button.addEventListener("click", () => {
      if (button.classList.contains("disabled")) return;
      container
        .querySelectorAll(".time-slot.selected")
        .forEach((el) => el.classList.remove("selected"));
      button.classList.add("selected");
      hiddenInput.value = slot.id;
      container.classList.remove(ERROR_BOX_CLASS);
    });

    container.appendChild(button);
  });
}

function markFieldError(field) {
  if (!(field instanceof HTMLElement)) return;
  field.classList.add(ERROR_FIELD_CLASS);
  const group = field.closest(".form-group");
  if (group) {
    group.classList.add(ERROR_GROUP_CLASS);
  }
}

function clearFieldError(field) {
  if (!(field instanceof HTMLElement)) return;
  field.classList.remove(ERROR_FIELD_CLASS);
  const group = field.closest(".form-group");
  if (!group) return;
  const stillInvalid = group.querySelector(`.${ERROR_FIELD_CLASS}`);
  if (!stillInvalid) {
    group.classList.remove(ERROR_GROUP_CLASS);
  }
}

function clearAllFieldErrors(form) {
  form
    .querySelectorAll(`.${ERROR_FIELD_CLASS}`)
    .forEach((el) => el.classList.remove(ERROR_FIELD_CLASS));
  form
    .querySelectorAll(`.${ERROR_GROUP_CLASS}`)
    .forEach((el) => el.classList.remove(ERROR_GROUP_CLASS));
  form
    .querySelectorAll(`.${ERROR_BOX_CLASS}`)
    .forEach((el) => el.classList.remove(ERROR_BOX_CLASS));
}

function validateAndHighlightForm(form, options = {}) {
  const consentCheckbox = options.consentCheckbox || document.getElementById("consent");
  const timeInput = options.timeInput || document.getElementById("time");
  const timeSlots = document.getElementById("time-slots");
  const consentRow = form.querySelector(".consent-row");

  clearAllFieldErrors(form);
  let isValid = true;
  let firstInvalidField = null;

  Array.from(form.elements).forEach((field) => {
    if (!(field instanceof HTMLElement)) return;
    if (field instanceof HTMLButtonElement) return;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
    if (field.type === "hidden" || field.disabled || !field.willValidate) return;
    if (field.closest("[hidden]")) return;

    if (!field.checkValidity()) {
      isValid = false;
      if (!firstInvalidField) firstInvalidField = field;
      markFieldError(field);
    }
  });

  if (!timeInput?.value) {
    isValid = false;
    if (timeSlots) {
      timeSlots.classList.add(ERROR_BOX_CLASS);
    }
  }

  if (consentCheckbox && !consentCheckbox.checked) {
    isValid = false;
    consentRow?.classList.add(ERROR_BOX_CLASS);
  }

  if (!isValid && firstInvalidField) {
    firstInvalidField.focus();
  }

  return isValid;
}

function highlightMissingRequiredFields(form) {
  let firstInvalidField = null;

  Array.from(form.elements).forEach((field) => {
    if (!(field instanceof HTMLElement)) return;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
    if (field.type === "hidden" || field.disabled || !field.willValidate) return;
    if (field.closest("[hidden]")) return;
    if (!field.required) return;

    const isEmptyFile = field instanceof HTMLInputElement && field.type === "file" && field.files && field.files.length === 0;
    const isEmptyValue = !String(field.value || "").trim();
    if (isEmptyFile || isEmptyValue) {
      markFieldError(field);
      if (!firstInvalidField) {
        firstInvalidField = field;
      }
    }
  });

  const timeInput = document.getElementById("time");
  const timeSlots = document.getElementById("time-slots");
  if (timeInput && !timeInput.value && timeSlots) {
    timeSlots.classList.add(ERROR_BOX_CLASS);
    if (!firstInvalidField) {
      firstInvalidField = timeSlots;
    }
  }

  if (firstInvalidField instanceof HTMLElement) {
    firstInvalidField.scrollIntoView({ behavior: "smooth", block: "center" });
    if (
      firstInvalidField instanceof HTMLInputElement ||
      firstInvalidField instanceof HTMLSelectElement ||
      firstInvalidField instanceof HTMLTextAreaElement
    ) {
      firstInvalidField.focus();
    }
  }
}

function buildBabyProfile(index, value = {}) {
  const wrapper = document.createElement("section");
  wrapper.className = "baby-card";
  wrapper.dataset.index = String(index);

  wrapper.innerHTML = `
    <h3 class="section-title">宝贝 ${index}</h3>
    <div class="spacing-sm"></div>
    <div class="form-group-inline">
      <div class="form-group">
        <label class="form-label" for="baby-name-${index}">宝贝名字<span class="required">*</span></label>
        <input
          type="text"
          id="baby-name-${index}"
          name="babyName${index}"
          placeholder="例如：奶油 / 小饼 / 糯米"
          required
          value="${escapeAttr(value.name)}"
        />
      </div>
      <div class="form-group">
        <label class="form-label" for="baby-age-${index}">宝贝年纪<span class="required">*</span></label>
        <input
          type="text"
          id="baby-age-${index}"
          name="babyAge${index}"
          placeholder="例如：3 岁 / 6 个月"
          required
          value="${escapeAttr(value.age)}"
        />
      </div>
      <div class="form-group">
        <label class="form-label" for="baby-breed-${index}">宝贝品种</label>
        <input
          type="text"
          id="baby-breed-${index}"
          name="babyBreed${index}"
          placeholder="例如：泰迪 / 比熊 / 英短"
          value="${escapeAttr(value.breed)}"
        />
      </div>
      <div class="form-group">
        <label class="form-label" for="baby-photo-${index}">上传宝贝近照<span class="required">*</span></label>
        <input
          type="file"
          id="baby-photo-${index}"
          name="babyPhoto${index}"
          accept="image/*"
          required
        />
      </div>
      <div class="form-group">
        <label class="form-label" for="baby-hobby-${index}">爱好</label>
        <input
          type="text"
          id="baby-hobby-${index}"
          name="babyHobby${index}"
          placeholder="例如：捡球、晒太阳、吃零食"
          value="${escapeAttr(value.hobby)}"
        />
      </div>
    </div>
    <div class="form-group-inline">
      <div class="form-group">
        <label class="form-label" for="baby-character-${index}">性格</label>
        <input
          type="text"
          id="baby-character-${index}"
          name="babyCharacter${index}"
          placeholder="例如：粘人、慢热、胆小、活泼"
          value="${escapeAttr(value.character)}"
        />
      </div>
      <div class="form-group">
        <label class="form-label" for="baby-attack-${index}">是否有过伤害别人的先例</label>
        <select id="baby-attack-${index}" name="babyAttackHistory${index}">
          <option value="">请选择</option>
          <option value="no" ${value.attack === "no" ? "selected" : ""}>没有</option>
          <option value="yes" ${value.attack === "yes" ? "selected" : ""}>有，请在备注中简单说明</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="baby-control-${index}">是否容易控制</label>
        <select id="baby-control-${index}" name="babyControllable${index}">
          <option value="">请选择</option>
          <option value="easy" ${value.control === "easy" ? "selected" : ""}>比较容易</option>
          <option value="normal" ${value.control === "normal" ? "selected" : ""}>一般</option>
          <option value="hard" ${value.control === "hard" ? "selected" : ""}>比较难</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="baby-exp-${index}">是否有过相关拍摄经验</label>
        <select id="baby-exp-${index}" name="babyExperience${index}">
          <option value="">请选择</option>
          <option value="first" ${value.exp === "first" ? "selected" : ""}>这是第一次</option>
          <option value="few" ${value.exp === "few" ? "selected" : ""}>偶尔拍过一两次</option>
          <option value="often" ${value.exp === "often" ? "selected" : ""}>经常拍摄</option>
        </select>
      </div>
    </div>
  `;

  return wrapper;
}

function collectBabyValues(container) {
  return Array.from(container.querySelectorAll(".baby-card")).map((card, idx) => {
    const index = idx + 1;
    const pick = (suffix) => card.querySelector(`#baby-${suffix}-${index}`)?.value || "";
    return {
      name: pick("name"),
      age: pick("age"),
      breed: pick("breed"),
      hobby: pick("hobby"),
      character: pick("character"),
      attack: pick("attack"),
      control: pick("control"),
      exp: pick("exp"),
    };
  });
}

function setupBabyProfiles() {
  const countSelect = document.getElementById("baby-count");
  const container = document.getElementById("baby-profiles");
  if (!countSelect || !container) return () => {};

  function renderProfiles() {
    const count = Math.min(2, Number(countSelect.value || 1));
    const oldValues = collectBabyValues(container);
    container.innerHTML = "";

    for (let i = 1; i <= count; i += 1) {
      const value = oldValues[i - 1] || {};
      container.appendChild(buildBabyProfile(i, value));
      if (i !== count) {
        const spacer = document.createElement("div");
        spacer.className = "spacing-md";
        container.appendChild(spacer);
      }
    }
  }

  countSelect.addEventListener("change", renderProfiles);
  renderProfiles();

  return () => {
    countSelect.value = "1";
    renderProfiles();
  };
}

function setupAllergyField() {
  const statusSelect = document.getElementById("allergy-status");
  const detailWrap = document.getElementById("allergy-detail-wrap");
  const detailInput = document.getElementById("allergy-detail");
  if (!statusSelect || !detailWrap || !detailInput) {
    return () => {};
  }

  function syncAllergyField() {
    const hasAllergy = statusSelect.value === "yes";
    detailWrap.hidden = !hasAllergy;
    detailInput.required = hasAllergy;
    if (!hasAllergy) {
      detailInput.value = "";
    }
  }

  statusSelect.addEventListener("change", syncAllergyField);
  syncAllergyField();

  return () => {
    statusSelect.value = "";
    syncAllergyField();
  };
}

function setupDateField() {
  const dateInput = document.getElementById("date");
  if (!dateInput) return async () => {};

  const tomorrow = getTomorrowISODate();
  dateInput.min = tomorrow;

  async function syncDateState(options = {}) {
    const preserveTimeId = options.preserveTimeId || "";
    const value = dateInput.value;
    if (!value) {
      renderTimeSlots(null);
      dateInput.setCustomValidity("");
      return false;
    }

    const selected = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selected <= today) {
      dateInput.value = "";
      dateInput.setCustomValidity("");
      renderTimeSlots(null);
      return false;
    }

    const availability = await fetchDateAvailability(value);
    if (!availability.available) {
      dateInput.setCustomValidity(UNAVAILABLE_MESSAGE);
      renderTimeSlots(value, { dateUnavailable: true });
      return false;
    }

    dateInput.setCustomValidity("");
    renderTimeSlots(value, { selectedTimeId: preserveTimeId });
    return true;
  }

  dateInput.addEventListener("change", () => {
    syncDateState();
  });

  return syncDateState;
}

function setupForm(syncDateState) {
  const form = document.getElementById("booking-form");
  const consentCheckbox = document.getElementById("consent");
  const consentError = document.getElementById("consent-error");
  const message = document.getElementById("form-message");
  const submitButton = document.getElementById("submit-button");

  if (!form) return;

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      if (target.checkValidity()) {
        clearFieldError(target);
      }
    }
  });

  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "consent") {
      const consentRow = form.querySelector(".consent-row");
      if (target instanceof HTMLInputElement && target.checked) {
        consentRow?.classList.remove(ERROR_BOX_CLASS);
      }
    }
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      if (target.checkValidity()) {
        clearFieldError(target);
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (message) message.textContent = "";

    if (!consentCheckbox.checked) {
      consentError.textContent = "提交前请先勾选“我已阅读并同意拍摄须知”。";
      consentCheckbox.focus();
      return;
    } else {
      consentError.textContent = "";
    }

    if (!validateAndHighlightForm(form, { consentCheckbox })) {
      return;
    }

    const dateInput = document.getElementById("date");
    const dateValue = dateInput.value;
    const timeValue = document.getElementById("time").value;
    const unavailableMessage = document.getElementById("booking-unavailable-message");

    const isDateStillAvailable = await syncDateState({ preserveTimeId: timeValue });
    if (!isDateStillAvailable) {
      if (unavailableMessage) {
        unavailableMessage.textContent = UNAVAILABLE_MESSAGE;
      }
      return;
    }

    if (!dateValue || !timeValue) {
      message.textContent = "请先选择合适的日期和时间段。";
      const timeSlots = document.getElementById("time-slots");
      if (timeSlots) {
        timeSlots.classList.add(ERROR_BOX_CLASS);
      }
      return;
    }

    if (submitButton) submitButton.disabled = true;

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/bookings", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (
          typeof data.message === "string" &&
          (data.message.includes("必填") || data.message.includes("完整填写"))
        ) {
          highlightMissingRequiredFields(form);
        }
        if (message) {
          message.textContent = data.message || "提交失败，请稍后重试。";
        }
        if (response.status === 409 && unavailableMessage) {
          unavailableMessage.textContent = UNAVAILABLE_MESSAGE;
          renderTimeSlots(dateValue, { dateUnavailable: true });
          if (dateInput) {
            dateInput.setCustomValidity(UNAVAILABLE_MESSAGE);
          }
        }
        return;
      }

      renderTimeSlots(dateValue, { dateUnavailable: true });
      if (dateInput) {
        dateInput.setCustomValidity(UNAVAILABLE_MESSAGE);
      }
      if (message) {
        message.textContent =
          "感谢您的填写，我们已收到预约信息。稍后将通过您留下的联系方式与您确认。";
      }

      form.reset();
      document.getElementById("time").value = "";
    } catch (error) {
      if (message) {
        message.textContent = "网络连接异常，请稍后再试。";
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  if (consentCheckbox && consentError) {
    consentCheckbox.addEventListener("change", () => {
      if (consentCheckbox.checked) {
        consentError.textContent = "";
        const consentRow = form.querySelector(".consent-row");
        consentRow?.classList.remove(ERROR_BOX_CLASS);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const resetBabyProfiles = setupBabyProfiles();
  const resetAllergyField = setupAllergyField();
  const syncDateState = setupDateField();
  renderTimeSlots(null);
  setupForm(syncDateState);

  // reset hook for booking form success
  const form = document.getElementById("booking-form");
  if (!form) return;
  form.addEventListener("reset", () => {
    resetBabyProfiles();
    resetAllergyField();
  });
});

