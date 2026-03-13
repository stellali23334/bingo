import json
import os
import queue
import sqlite3
import threading
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from flask import Flask, Response, jsonify, request
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "bingo_studio.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=".", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

subscribers = []
subscribers_lock = threading.Lock()


def db_connect():
  conn = sqlite3.connect(DB_PATH)
  conn.row_factory = sqlite3.Row
  return conn


def init_db():
  conn = db_connect()
  cur = conn.cursor()
  cur.execute(
    """
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      booking_date TEXT NOT NULL UNIQUE,
      time_slot TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      wechat_id TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      baby_count INTEGER NOT NULL,
      music_playlist TEXT,
      music_style TEXT,
      allergy_status TEXT,
      allergy_detail TEXT,
      emotion_question TEXT,
      consent INTEGER NOT NULL DEFAULT 1,
      raw_json TEXT
    )
    """
  )
  cur.execute(
    """
    CREATE TABLE IF NOT EXISTS booking_babies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      baby_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      age TEXT NOT NULL,
      breed TEXT,
      hobby TEXT,
      character TEXT,
      attack_history TEXT,
      controllable TEXT,
      experience TEXT,
      photo_path TEXT,
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )
    """
  )
  cur.execute(
    """
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      rating INTEGER,
      fav_part TEXT,
      fav_photo TEXT,
      compare_expect TEXT,
      favorite_part TEXT,
      expected_service TEXT,
      advice TEXT,
      photo_path TEXT,
      raw_json TEXT
    )
    """
  )
  conn.commit()
  conn.close()


@app.before_request
def ensure_db_schema():
  # Auto-heal schema if DB file was recreated/cleared.
  init_db()


def now_iso():
  return datetime.now().isoformat(timespec="seconds")


def tomorrow_iso():
  return (date.today() + timedelta(days=1)).isoformat()


def is_date_available(booking_date: str) -> bool:
  conn = db_connect()
  cur = conn.cursor()
  cur.execute("SELECT 1 FROM bookings WHERE booking_date = ? LIMIT 1", (booking_date,))
  row = cur.fetchone()
  conn.close()
  return row is None


def save_upload(file_storage, prefix: str) -> str:
  if not file_storage or not file_storage.filename:
    return ""
  safe_name = secure_filename(file_storage.filename)
  ext = Path(safe_name).suffix.lower()
  file_name = f"{prefix}_{uuid.uuid4().hex[:10]}{ext}"
  target = UPLOAD_DIR / file_name
  file_storage.save(target)
  return f"data/uploads/{file_name}"


def broadcast_event(event_name: str, payload: dict):
  message = json.dumps({"event": event_name, "payload": payload}, ensure_ascii=False)
  with subscribers_lock:
    dead = []
    for q in subscribers:
      try:
        q.put_nowait(message)
      except queue.Full:
        dead.append(q)
    for q in dead:
      if q in subscribers:
        subscribers.remove(q)


@app.get("/api/health")
def api_health():
  return jsonify({"ok": True, "time": now_iso()})


@app.get("/api/bookings/availability")
def api_booking_availability():
  booking_date = (request.args.get("date") or "").strip()
  if not booking_date:
    return jsonify({"available": False, "message": "缺少日期参数。"}), 400

  try:
    parsed = date.fromisoformat(booking_date)
  except ValueError:
    return jsonify({"available": False, "message": "日期格式错误。"}), 400

  if parsed < (date.today() + timedelta(days=1)):
    return jsonify({"available": False, "message": "仅可预约明天及之后日期。"}), 200

  available = is_date_available(booking_date)
  return jsonify(
    {
      "available": available,
      "date": booking_date,
      "message": "" if available else "该时间段已被预约，请选择另外合适的时间。",
    }
  )


@app.post("/api/bookings")
def api_create_booking():
  form = request.form
  files = request.files

  booking_date = (form.get("date") or "").strip()
  time_slot = (form.get("time") or "").strip()
  owner_name = (form.get("ownerName") or "").strip()
  wechat_id = (form.get("wechatId") or "").strip()
  email = (form.get("email") or "").strip()
  phone = (form.get("phone") or "").strip()
  consent = 1 if form.get("consent") else 0

  required_fields = [booking_date, time_slot, owner_name, wechat_id, email, phone]
  if not all(required_fields):
    return jsonify({"ok": False, "message": "请完整填写必填信息。"}), 400

  try:
    parsed = date.fromisoformat(booking_date)
  except ValueError:
    return jsonify({"ok": False, "message": "日期格式错误。"}), 400

  if parsed < (date.today() + timedelta(days=1)):
    return jsonify({"ok": False, "message": "仅可预约明天及之后日期。"}), 400

  if not is_date_available(booking_date):
    return jsonify({"ok": False, "message": "该时间段已被预约，请选择另外合适的时间。"}), 409

  try:
    baby_count = int(form.get("babyCount") or "1")
  except ValueError:
    baby_count = 1
  baby_count = min(2, max(1, baby_count))
  babies = []
  for idx in range(1, baby_count + 1):
    baby_name = (form.get(f"babyName{idx}") or "").strip()
    baby_age = (form.get(f"babyAge{idx}") or "").strip()
    if not baby_name or not baby_age:
      return jsonify({"ok": False, "message": f"请完整填写第 {idx} 位宝贝信息。"}), 400
    photo_path = save_upload(files.get(f"babyPhoto{idx}"), f"baby{idx}")
    babies.append(
      {
        "index": idx,
        "name": baby_name,
        "age": baby_age,
        "breed": (form.get(f"babyBreed{idx}") or "").strip(),
        "hobby": (form.get(f"babyHobby{idx}") or "").strip(),
        "character": (form.get(f"babyCharacter{idx}") or "").strip(),
        "attack": (form.get(f"babyAttackHistory{idx}") or "").strip(),
        "control": (form.get(f"babyControllable{idx}") or "").strip(),
        "exp": (form.get(f"babyExperience{idx}") or "").strip(),
        "photo_path": photo_path,
      }
    )

  payload = {
    "date": booking_date,
    "time": time_slot,
    "ownerName": owner_name,
    "wechatId": wechat_id,
    "email": email,
    "phone": phone,
    "babyCount": baby_count,
    "musicPlaylist": (form.get("musicPlaylist") or "").strip(),
    "musicStyle": (form.get("musicStyle") or "").strip(),
    "allergyStatus": (form.get("allergyStatus") or "").strip(),
    "allergyDetail": (form.get("allergyDetail") or "").strip(),
    "emotionQuestion": (form.get("emotionQuestion") or "").strip(),
    "consent": consent,
    "babies": babies,
  }

  conn = db_connect()
  cur = conn.cursor()
  try:
    cur.execute(
      """
      INSERT INTO bookings (
        created_at, booking_date, time_slot, owner_name, wechat_id, email, phone, baby_count,
        music_playlist, music_style, allergy_status, allergy_detail, emotion_question, consent, raw_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """,
      (
        now_iso(),
        payload["date"],
        payload["time"],
        payload["ownerName"],
        payload["wechatId"],
        payload["email"],
        payload["phone"],
        payload["babyCount"],
        payload["musicPlaylist"],
        payload["musicStyle"],
        payload["allergyStatus"],
        payload["allergyDetail"],
        payload["emotionQuestion"],
        payload["consent"],
        json.dumps(payload, ensure_ascii=False),
      ),
    )
    booking_id = cur.lastrowid
    for baby in babies:
      cur.execute(
        """
        INSERT INTO booking_babies (
          booking_id, baby_index, name, age, breed, hobby, character, attack_history, controllable, experience, photo_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
          booking_id,
          baby["index"],
          baby["name"],
          baby["age"],
          baby["breed"],
          baby["hobby"],
          baby["character"],
          baby["attack"],
          baby["control"],
          baby["exp"],
          baby["photo_path"],
        ),
      )
    conn.commit()
  except sqlite3.IntegrityError:
    conn.rollback()
    conn.close()
    return jsonify({"ok": False, "message": "该时间段已被预约，请选择另外合适的时间。"}), 409
  finally:
    conn.close()

  broadcast_event(
    "booking_created",
    {
      "date": payload["date"],
      "time": payload["time"],
      "ownerName": payload["ownerName"],
      "phone": payload["phone"],
    },
  )
  return jsonify({"ok": True, "message": "预约已提交成功。"})


@app.post("/api/feedback")
def api_create_feedback():
  form = request.form
  files = request.files
  source = (form.get("source") or "listener").strip().lower()
  if source not in ("feedback", "listener"):
    source = "listener"

  payload = {
    "source": source,
    "rating": (form.get("rating") or "").strip(),
    "favPart": (form.get("favPart") or "").strip(),
    "favPhoto": (form.get("favPhoto") or "").strip(),
    "compareExpect": (form.get("compareExpect") or "").strip(),
    "favoritePart": (form.get("listenerFavoritePart") or "").strip(),
    "expectedService": (form.get("listenerExpectedService") or "").strip(),
    "advice": (form.get("listenerAdvice") or "").strip(),
    "photoPath": save_upload(files.get("listenerPhoto"), "listener"),
  }

  has_any = any(
    [
      payload["rating"],
      payload["favPart"],
      payload["favPhoto"],
      payload["compareExpect"],
      payload["favoritePart"],
      payload["expectedService"],
      payload["advice"],
      payload["photoPath"],
    ]
  )
  if not has_any:
    return jsonify({"ok": False, "message": "请至少填写一项反馈内容。"}), 400

  conn = db_connect()
  cur = conn.cursor()
  cur.execute(
    """
    INSERT INTO feedbacks (
      created_at, source, rating, fav_part, fav_photo, compare_expect,
      favorite_part, expected_service, advice, photo_path, raw_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
    (
      now_iso(),
      payload["source"],
      int(payload["rating"]) if payload["rating"].isdigit() else None,
      payload["favPart"],
      payload["favPhoto"],
      payload["compareExpect"],
      payload["favoritePart"],
      payload["expectedService"],
      payload["advice"],
      payload["photoPath"],
      json.dumps(payload, ensure_ascii=False),
    ),
  )
  conn.commit()
  conn.close()

  broadcast_event("feedback_created", {"source": payload["source"]})
  return jsonify({"ok": True, "message": "反馈已提交成功。"})


def query_bookings():
  conn = db_connect()
  cur = conn.cursor()
  cur.execute(
    """
    SELECT
      b.id, b.created_at, b.booking_date, b.time_slot, b.owner_name, b.wechat_id, b.email, b.phone,
      b.baby_count, b.music_playlist, b.music_style, b.allergy_status, b.allergy_detail, b.emotion_question
    FROM bookings b
    ORDER BY b.created_at DESC
    """
  )
  bookings = [dict(row) for row in cur.fetchall()]
  for booking in bookings:
    cur.execute(
      """
      SELECT baby_index, name, age, breed, hobby, character, attack_history, controllable, experience, photo_path
      FROM booking_babies
      WHERE booking_id = ?
      ORDER BY baby_index ASC
      """,
      (booking["id"],),
    )
    booking["babies"] = [dict(row) for row in cur.fetchall()]
  conn.close()
  return bookings


def query_feedbacks():
  conn = db_connect()
  cur = conn.cursor()
  cur.execute(
    """
    SELECT
      id, created_at, source, rating, fav_part, fav_photo, compare_expect,
      favorite_part, expected_service, advice, photo_path
    FROM feedbacks
    ORDER BY created_at DESC
    """
  )
  rows = [dict(row) for row in cur.fetchall()]
  conn.close()
  return rows


@app.get("/api/admin/data")
def api_admin_data():
  bookings = query_bookings()
  feedbacks = query_feedbacks()
  return jsonify(
    {
      "bookings": bookings,
      "feedbacks": feedbacks,
      "meta": {
        "bookingsCount": len(bookings),
        "feedbacksCount": len(feedbacks),
        "generatedAt": now_iso(),
      },
    }
  )


@app.get("/api/admin/stream")
def api_admin_stream():
  client_queue = queue.Queue(maxsize=100)
  with subscribers_lock:
    subscribers.append(client_queue)

  def event_stream():
    try:
      yield "event: ping\ndata: connected\n\n"
      while True:
        try:
          payload = client_queue.get(timeout=20)
          yield f"event: update\ndata: {payload}\n\n"
        except queue.Empty:
          yield "event: ping\ndata: keepalive\n\n"
    finally:
      with subscribers_lock:
        if client_queue in subscribers:
          subscribers.remove(client_queue)

  return Response(event_stream(), mimetype="text/event-stream")


@app.get("/")
def root():
  return app.send_static_file("index.html")


init_db()


if __name__ == "__main__":
  port = int(os.environ.get("PORT", "5050"))
  app.run(host="0.0.0.0", port=port, debug=True, threaded=True)
