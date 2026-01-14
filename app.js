/**
 * 德州扑克 AI 教练 - 拍照分析版
 * 使用标准 HTTPS 请求，网络兼容性最强
 */

const CONFIG = {
    // 推荐使用 1.5 Pro 处理复杂逻辑，或 1.5 Flash 追求速度
    MODEL: 'gemini-1.5-flash', 
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    SYSTEM_INSTRUCTION: `你是一个专业的德州扑克教练。请识别画面中的手牌、公共牌、底池。
    根据 GTO 策略给出回复：
    【建议】: FOLD / CALL / CHECK / RAISE
    【理由】: 简短解释。`
};

const state = {
    apiKey: localStorage.getItem('gemini_api_key') || '',
    videoStream: null,
    isAnalyzing: false
};

const elements = {
    apiKeyInput: document.getElementById('apiKey'),
    saveApiKey: document.getElementById('saveApiKey'),
    videoElement: document.getElementById('videoElement'),
    captureCanvas: document.getElementById('captureCanvas'),
    analysisContent: document.getElementById('analysisContent'),
    recommendationContent: document.getElementById('recommendationContent'),
    currentStatus: document.getElementById('currentStatus')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    if (state.apiKey) elements.apiKeyInput.value = state.apiKey;
    elements.saveApiKey.onclick = () => {
        state.apiKey = elements.apiKeyInput.value.trim();
        localStorage.setItem('gemini_api_key', state.apiKey);
        alert('API Key 已保存');
    };
    // 修改原有的“开始摄像头”逻辑
    document.getElementById('startCamera').onclick = startCamera;
    
    // 创建一个“拍照分析”按钮（借用原有的连接按钮逻辑，或提示用户点击）
    const analyzeBtn = document.createElement('button');
    analyzeBtn.innerText = "📸 分析当前画面";
    analyzeBtn.className = "btn btn-primary";
    analyzeBtn.style.marginTop = "10px";
    analyzeBtn.onclick = captureAndAnalyze;
    document.querySelector('.controls').appendChild(analyzeBtn);
});

async function startCamera() {
    try {
        state.videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        elements.videoElement.srcObject = state.videoStream;
        document.getElementById('videoOverlay').classList.add('hidden');
        updateStatus('摄像头已就绪');
    } catch (e) {
        alert('无法启动摄像头: ' + e.message);
    }
}

async function captureAndAnalyze() {
    if (!state.apiKey) return alert('请先输入并保存 API Key');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('正在拍照并分析...');
    
    // 1. 拍照
    const canvas = elements.captureCanvas;
    const video = elements.videoElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // 2. 发送请求 (标准 HTTPS POST)
    const url = `${CONFIG.API_URL}${CONFIG.MODEL}:generateContent?key=${state.apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: CONFIG.SYSTEM_INSTRUCTION + " 请分析这张图片。" },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        
        displayResult(text);
        updateStatus('分析完成');
    } catch (e) {
        console.error(e);
        updateStatus('分析失败，请检查网络');
    } finally {
        state.isAnalyzing = false;
    }
}

function displayResult(text) {
    elements.analysisContent.innerText = text;
    const match = text.match(/(FOLD|CALL|CHECK|RAISE)/i);
    const action = match ? match[0].toUpperCase() : 'WAIT';
    elements.recommendationContent.innerHTML = `<div class="action-badge ${action.toLowerCase()}">${action}</div>`;
}

function updateStatus(t) { elements.currentStatus.innerText = t; }
