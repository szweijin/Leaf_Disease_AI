// 註冊
async function register() {
  const email = document.getElementById("reg_email").value;
  const password = document.getElementById("reg_password").value;

  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  alert(JSON.stringify(data));
}

// 登入
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  alert(JSON.stringify(data));
}

// 登出
async function logout() {
  const res = await fetch("/logout");
  const data = await res.json();
  alert(JSON.stringify(data));
}

let base64Image = "";

// 圖片預覽
function preview(event) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("previewImg").src = e.target.result;
    base64Image = e.target.result;
  };
  reader.readAsDataURL(event.target.files[0]);
}

// YOLO 預測
async function predict() {
  const res = await fetch("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image }),
  });

  const data = await res.json();
  alert(JSON.stringify(data));
}

// 歷史紀錄
async function loadHistory() {
  const res = await fetch("/history");
  const data = await res.json();

  const list = document.getElementById("historyList");
  list.innerHTML = "";

  data.forEach((r) => {
    const item = document.createElement("li");
    item.textContent = `${r.disease} (${r.severity}) - ${r.confidence}`;
    list.appendChild(item);
  });
}
