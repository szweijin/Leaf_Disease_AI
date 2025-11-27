from flask import Flask, request, jsonify, session, render_template
from werkzeug.security import generate_password_hash, check_password_hash
from ultralytics import YOLO
import base64
import json
import os

app = Flask(__name__)
app.secret_key = "local_dev_secret"

# YOLOv11
model = YOLO("yolov11/best.pt")

# JSON 資料
USERS_FILE = "data/users.json"
RECORDS_FILE = "data/records.json"


def load_json(path):
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


### -----------------------
### 註冊
### -----------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    email = data["email"]
    password = generate_password_hash(data["password"])

    users = load_json(USERS_FILE)

    # email 重複檢查
    if any(u["email"] == email for u in users):
        return jsonify({"error": "Email already exists"}), 400

    users.append({"email": email, "password": password})
    save_json(USERS_FILE, users)

    return jsonify({"status": "registered"})


### -----------------------
### 登入
### -----------------------
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data["email"]
    password = data["password"]

    users = load_json(USERS_FILE)

    user = next((u for u in users if u["email"] == email), None)
    if user and check_password_hash(user["password"], password):
        session["email"] = email
        return jsonify({"status": "logged_in"})

    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/logout")
def logout():
    session.pop("email", None)
    return jsonify({"status": "logged_out"})


### -----------------------
### YOLO 預測
### -----------------------
@app.route("/predict", methods=["POST"])
def predict():
    if "email" not in session:
        return jsonify({"error": "Not logged in"}), 401

    img_data = request.json["image"]
    img_bytes = base64.b64decode(img_data.split(",")[1])

    img_path = "temp.jpg"
    with open(img_path, "wb") as f:
        f.write(img_bytes)

    results = model(img_path)[0]
    boxes = results.boxes

    if len(boxes) == 0:
        return jsonify({"result": "No disease detected"})

    cls_id = int(boxes[0].cls)
    confidence = float(boxes[0].conf)
    disease_name = results.names[cls_id]

    severity = disease_name.split("_")[-1]

    # 存紀錄
    records = load_json(RECORDS_FILE)
    records.append({
        "email": session["email"],
        "disease": disease_name,
        "severity": severity,
        "confidence": confidence
    })
    save_json(RECORDS_FILE, records)

    return jsonify({
        "disease": disease_name,
        "severity": severity,
        "confidence": confidence
    })


### -----------------------
### 歷史紀錄
### -----------------------
@app.route("/history")
def history():
    if "email" not in session:
        return jsonify({"error": "Not logged in"}), 401

    records = load_json(RECORDS_FILE)
    user_records = [r for r in records if r["email"] == session["email"]]

    return jsonify(user_records)


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True)
