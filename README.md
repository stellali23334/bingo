宠物拍摄预约网站
================

这个项目是一个简洁、安静、有纪念感气质的中文宠物拍摄预约网站，包括：

- 首页（入口与服务内容）
- 预约页面（日期与时间段选择、表单、拍摄须知）
- 常见问题页面（包含拍摄须知相关内容）
- 回馈反馈页面（简单四个问题）
- Listener 页面（用于收集用户反馈）
- 后台管理页面（实时查看预约与反馈）

## 本地运行（含实时后台）

1. 创建并激活 Python 虚拟环境（仅首次）：

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. 启动服务：

   ```bash
   python3 app.py
   ```

3. 打开页面：

   - 站点首页：`http://127.0.0.1:5050`
   - 后台管理：`http://127.0.0.1:5050/admin.html`

## 技术栈

- 原生 HTML / CSS / JavaScript
- Flask（后端 API 与静态资源服务）
- SQLite（预约与反馈数据持久化）
- SSE（后台页面实时更新）

## 项目结构

- `index.html`：首页
- `booking.html`：预约页面（日期与时间段逻辑、预约表单、情感问题、拍摄须知、确认勾选）
- `faq.html`：常见问题页面（包含“拍摄须知”等基础 FAQ）
- `feedback.html`：反馈页面（4 个问题）
- `about.html`：Listener 反馈页面
- `styles.css`：全站公用样式
- `booking.js`：预约页面交互逻辑（日期/时间段/提交校验）
- `feedback.js`：反馈页面与 Listener 页面提交逻辑
- `admin.html`：后台管理页面
- `admin.js`：后台数据渲染与实时刷新
- `app.py`：后端服务（API + 数据库 + 实时推送）
- `data/bingo_studio.db`：SQLite 数据库文件（运行后自动生成）
- `data/uploads/`：用户上传图片（运行后自动生成）

## 说明

- 预约规则：某一天一旦有任意时段被预约，该日期全部时段不可再选。
- 用户提交预约/反馈后，后台页面会实时收到并刷新。
