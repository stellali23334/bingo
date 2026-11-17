function textOrDash(value) {
  return value ? String(value) : "—";
}

function renderBookings(bookings) {
  const root = document.getElementById("bookings-list");
  if (!root) return;
  if (!bookings.length) {
    root.innerHTML = "<p class='helper-text'>暂无预约记录。</p>";
    return;
  }

  root.innerHTML = bookings
    .map((item) => {
      const babies = (item.babies || [])
        .map(
          (baby) =>
            `<li>宝贝${baby.baby_index}：${textOrDash(baby.name)} / ${textOrDash(
              baby.age
            )} / ${textOrDash(baby.breed)}</li>`
        )
        .join("");

      return `
        <article class="admin-item">
          <div class="admin-item-title">${textOrDash(item.owner_name)} · ${textOrDash(
            item.booking_date
          )} ${textOrDash(item.time_slot)}${item.is_demo ? " · 模拟记录" : ""}</div>
          <div class="admin-item-meta">联系方式：${textOrDash(item.phone)} / ${textOrDash(
        item.wechat_id
      )}</div>
          <div class="admin-item-meta">邮箱：${textOrDash(item.email)}</div>
          <div class="admin-item-meta">音乐偏好：${textOrDash(
            item.music_playlist
          )} ${textOrDash(item.music_style)}</div>
          <div class="admin-item-meta">过敏源：${textOrDash(item.allergy_detail)}</div>
          <div class="admin-item-meta">提问：${textOrDash(item.emotion_question)}</div>
          <ul class="admin-sublist">${babies}</ul>
        </article>
      `;
    })
    .join("");
}

function renderFeedbacks(feedbacks) {
  const root = document.getElementById("feedbacks-list");
  if (!root) return;
  if (!feedbacks.length) {
    root.innerHTML = "<p class='helper-text'>暂无反馈记录。</p>";
    return;
  }

  root.innerHTML = feedbacks
    .map(
      (item) => `
      <article class="admin-item">
        <div class="admin-item-title">${item.source === "listener" ? "listener" : "feedback"} · ${textOrDash(
        item.created_at
      )}</div>
        <div class="admin-item-meta">评分：${textOrDash(item.rating)}</div>
        <div class="admin-item-meta">喜欢的环节：${textOrDash(
          item.fav_part || item.favorite_part
        )}</div>
        <div class="admin-item-meta">喜欢的照片：${textOrDash(item.fav_photo)}</div>
        <div class="admin-item-meta">预期对比：${textOrDash(item.compare_expect)}</div>
        <div class="admin-item-meta">期待服务：${textOrDash(item.expected_service)}</div>
        <div class="admin-item-meta">建议：${textOrDash(item.advice)}</div>
      </article>
    `
    )
    .join("");
}

async function loadData() {
  const response = await fetch(`/api/admin/data?_=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("加载失败");
  }
  const data = await response.json();
  document.getElementById("bookings-count").textContent = String(
    data.meta?.bookingsCount || 0
  );
  document.getElementById("feedbacks-count").textContent = String(
    data.meta?.feedbacksCount || 0
  );
  renderBookings(data.bookings || []);
  renderFeedbacks(data.feedbacks || []);
  const streamStatus = document.getElementById("stream-status");
  if (streamStatus) streamStatus.textContent = "数据已更新";
}

function setupRealtime() {
  const streamStatus = document.getElementById("stream-status");
  const source = new EventSource("/api/admin/stream");

  source.addEventListener("open", () => {
    if (streamStatus) streamStatus.textContent = "已连接";
  });

  source.addEventListener("update", async () => {
    if (streamStatus) streamStatus.textContent = "收到新数据";
    try {
      await loadData();
    } catch (error) {
      if (streamStatus) streamStatus.textContent = "刷新失败";
    }
  });

  source.onerror = () => {
    if (streamStatus) streamStatus.textContent = "连接中断，重连中...";
  };

  return source;
}

document.addEventListener("DOMContentLoaded", async () => {
  const streamStatus = document.getElementById("stream-status");
  try {
    await loadData();
  } catch (error) {
    if (streamStatus) streamStatus.textContent = "初始加载失败";
  }
  setupRealtime();
  window.setInterval(async () => {
    try {
      await loadData();
    } catch (error) {
      if (streamStatus) streamStatus.textContent = "自动刷新失败";
    }
  }, 15000);
});
