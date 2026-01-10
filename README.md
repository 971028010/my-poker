# 德州扑克 AI 教练

基于 Gemini 2.0 Flash Multimodal Live API 的实时德州扑克策略分析应用。

## 功能特点

- **实时摄像头捕获**：调用手机后置摄像头，实时显示画面
- **AI 图像分析**：每 2 秒自动截取视频帧，发送给 Gemini API 分析
- **GTO 策略建议**：基于博弈论最优策略，给出 Fold/Call/Check/Raise 建议
- **历史记录**：保存最近 10 条分析记录

## 使用方法

### 1. 获取 API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 登录你的 Google 账号
3. 点击 "Get API key" 获取 API Key

### 2. 使用应用

1. 在输入框中填入你的 Google AI Studio API Key
2. 点击「保存并连接」按钮
3. 等待连接状态变为「已连接」
4. 点击「启动摄像头」按钮
5. 将摄像头对准扑克牌局
6. AI 将每 2 秒自动分析画面并给出建议

### 3. 界面说明

- **GTO 建议**：显示当前推荐的操作（FOLD/CALL/CHECK/RAISE）
- **AI 分析结果**：显示详细的分析内容，包括识别到的手牌、公共牌等
- **分析历史**：显示最近的分析记录

## 技术栈

- 原生 HTML5 + CSS3 + JavaScript
- HTML5 Canvas 图像处理
- WebSocket 连接 Gemini Live API
- MediaDevices API 摄像头访问

## 注意事项

1. **HTTPS 要求**：摄像头访问需要 HTTPS 环境（或 localhost）
2. **浏览器兼容**：推荐使用 Chrome、Safari 或 Edge 浏览器
3. **摄像头权限**：首次使用需要授予摄像头访问权限
4. **API 配额**：请注意 Gemini API 的使用配额限制

## 文件结构

```
poker-coach-app/
├── index.html    # 主页面
├── styles.css    # 样式文件
├── app.js        # 应用逻辑
└── README.md     # 说明文档
```

## 部署

本应用是纯静态网站，可以部署到任何支持 HTTPS 的静态托管服务：

- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages

## 许可证

MIT License
