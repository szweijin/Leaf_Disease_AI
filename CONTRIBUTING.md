# Contributing to Leaf Disease AI

感謝您對本專案的興趣！我們歡迎各種形式的貢獻。

## 開始貢獻

### 報告 Bug

在報告 Bug 時，請提供以下信息：

1. **Bug 描述**：清晰說明問題是什麼
2. **重現步驟**：詳細的重現步驟
3. **預期行為**：應該發生什麼
4. **實際行為**：實際發生了什麼
5. **環境信息**：
   - Python 版本
   - Flask 版本
   - 作業系統
   - 瀏覽器版本

### 提交功能請求

提交新功能時，請：

1. 清晰描述功能的目的和用途
2. 提供可能的實現方式
3. 說明為什麼需要這個功能

## 開發流程

### 1. Fork 並 Clone

```bash
git clone https://github.com/your-username/Leaf_Disease_AI.git
cd Leaf_Disease_AI
```

### 2. 建立開發分支

```bash
# 建立分支
git checkout -b feature/feature-name
# 或者修復 bug
git checkout -b bugfix/bug-name
```

### 3. 開發與測試

```bash
# 安裝開發依賴
pip install -r requirements.txt

# 運行應用
python app.py

# 進行測試
python -m pytest
```

### 4. 提交更改

```bash
# 檢查修改
git status

# 添加檔案
git add .

# 提交並寫清晰的提交信息
git commit -m "Add feature: [簡短描述]"
```

### 5. 推送並建立 Pull Request

```bash
# 推送到遠程
git push origin feature/feature-name
```

然後在 GitHub 上建立 Pull Request。

## 提交信息規範

請遵循以下格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:

- `feat`: 新功能
- `fix`: 修復 bug
- `docs`: 文檔更新
- `style`: 代碼格式
- `refactor`: 代碼重構
- `perf`: 性能優化
- `test`: 測試更新
- `chore`: 構建/工具更新

**例子**:

```
feat(auth): add password complexity validation

Add validation to ensure passwords meet security requirements:
- Minimum 8 characters
- Must contain uppercase and lowercase letters
- Must contain at least one digit

Closes #123
```

## 代碼風格

- 使用 Python PEP 8 風格指南
- JavaScript 遵循 ES6 標準
- 使用有意義的變數名
- 添加適當的註釋

## 測試

在提交 PR 之前，請確保：

1. 代碼通過所有現有測試
2. 新功能有相應的測試
3. 本地測試全部通過

```bash
# 運行測試
python -m pytest

# 檢查代碼覆蓋率
python -m pytest --cov=app
```

## 文檔

- 更新 README.md 中相關的文檔
- 在代碼中添加必要的註釋
- 如果添加了新的 API 端點，在 README 中更新 API 文檔

## License

通過提交代碼，您同意您的貢獻將遵循本專案的 MIT 許可證。

## 行為準則

### 我們的承諾

為了建立開放和友好的社區環境，我們作為貢獻者和維護者承諾：

- 提供一個無騷擾、無歧視的環境
- 尊重不同的觀點和經驗
- 接受建設性的批評
- 將社區利益放在首位

### 不可接受的行為

- 使用性別化或貶低性語言
- 個人攻擊
- 騷擾或騷擾他人
- 發佈他人的私人信息
- 其他不專業的行為

違反本準則的行為將導致被排除在社區之外。

## 問題？

如有任何問題，請：

- 提交 Issue
- 發送電子郵件至 [項目聯繫方式]

感謝您的貢獻！ 🎉
