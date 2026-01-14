/**
 * 德州扑克 AI 教练 - 拍照分析稳定版
 */

const CONFIG = {
    // 使用兼容性最好的 1.5 Flash 模型
    MODEL: 'gemini-1.5-flash', 
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    SYSTEM_INSTRUCTION: `你是一个专业的德州扑克教练。请识别画面中的：
    1. 手牌（你的两张底牌）
    2. 公共牌
    3. 底池和下注情况
    根据 GTO 策略，给出 FOLD / CALL / CHECK / RAISE 建议并简短解释原因。`
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
    
    // 绑定保存按钮
    elements.saveApiKey.onclick = () => {
        const key = elements.apiKeyInput.value.trim();
        if (key) {
            state.apiKey = key;
            localStorage.setItem('gemini_api_key', key);
            updateStatus('API Key 已保存');
        }
    };

    // 绑定摄像头和分析按钮
    document.getElementById('startCamera').onclick = startCamera;
    
    // 创建一个明显的“分析”按钮
    const analyzeBtn = document.createElement('button');
    analyzeBtn.id = "captureBtn";
    analyzeBtn.innerHTML = "📸 拍照并分析建议";
    analyzeBtn.className = "btn btn-success";
    analyzeBtn.style.marginTop = "15px";
    analyzeBtn.style.fontSize = "1.2rem";
    analyzeBtn.onclick = captureAndAnalyze;
    document.querySelector('.controls').appendChild(analyzeBtn);
});

async function startCamera() {
    try {
        state.videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: 1280, height: 720 }
        });
        elements.videoElement.srcObject = state.videoStream;
        document.getElementById('videoOverlay').classList.add('hidden');
        updateStatus('摄像头已就绪');
    } catch (e) {
        alert('无法启动摄像头: ' + e.message + '。请确保使用了 HTTPS 链接。');
    }
}

async function captureAndAnalyze() {
    if (!state.apiKey) return alert('请先输入并保存 API Key');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('🔍 正在识别牌局中...');
    
    // 1. 捕捉当前画面
    const canvas = elements.captureCanvas;
    const video = elements.videoElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // 压缩图片以加快传输速度
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // 2. 发送标准 HTTPS 请求
    const url = `${CONFIG.API_URL}${CONFIG.MODEL}:generateContent?key=${state.apiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: CONFIG.SYSTEM_INSTRUCTION },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const text = data.candidates[0].content.parts[0].text;
        displayResult(text);
        updateStatus('✅ 分析完成');
    } catch (e) {
        console.error(e);
        updateStatus('❌ 失败: ' + e.message);
    } finally {
        state.isAnalyzing = false;
    }
}

function displayResult(text) {
    elements.analysisContent.innerText = text;
    // 简单解析建议动作
    const actions = ['FOLD', 'CALL', 'CHECK', 'RAISE'];
    let foundAction = 'WAIT';
    for (const action of actions) {
        if (text.toUpperCase().includes(action)) {
            foundAction = action;
            break;
        }
    }
    elements.recommendationContent.innerHTML = `<div class="action-badge ${foundAction.toLowerCase()}">${foundAction}</div>`;
}

function updateStatus(t) { elements.currentStatus.innerText = t; }
