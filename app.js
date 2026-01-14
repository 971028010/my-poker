/**
 * 德州扑克 AI 教练 - 拍照分析最终版
 */

const CONFIG = {
    // 修正：在 v1beta 路径下，模型标识符需保持简洁
    MODEL: 'gemini-1.5-flash', 
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
    SYSTEM_INSTRUCTION: `你是一个专业的德州扑克教练。请识别画面中的：
    1. 手牌（你的两张底牌）
    2. 公共牌（翻牌、转牌、河牌）
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

// 初始化逻辑
document.addEventListener('DOMContentLoaded', () => {
    if (state.apiKey) elements.apiKeyInput.value = state.apiKey;
    
    // 保存 Key 逻辑
    elements.saveApiKey.onclick = () => {
        const key = elements.apiKeyInput.value.trim();
        if (key) {
            state.apiKey = key;
            localStorage.setItem('gemini_api_key', key);
            updateStatus('✅ API Key 已保存');
        } else {
            alert('请输入 API Key');
        }
    };

    // 绑定摄像头
    document.getElementById('startCamera').onclick = startCamera;
    
    // 拍照分析按钮逻辑
    document.getElementById('captureBtn').onclick = captureAndAnalyze;
});

async function startCamera() {
    try {
        // 请求环境摄像头（后置）
        state.videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        elements.videoElement.srcObject = state.videoStream;
        document.getElementById('videoOverlay').classList.add('hidden');
        updateStatus('📷 摄像头就绪');
    } catch (e) {
        alert('无法启动摄像头: ' + e.message + '。请检查是否开启 HTTPS 和权限。');
    }
}

async function captureAndAnalyze() {
    if (!state.apiKey) return alert('请先保存有效 API Key');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('🔍 正在识别牌局并计算策略...');
    
    const canvas = elements.captureCanvas;
    const video = elements.videoElement;
    
    // 捕获当前帧
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // 转换为 Base64
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // 构建标准 REST 请求 URL
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
        console.error('API Error:', e);
        updateStatus('❌ 失败: ' + e.message);
    } finally {
        state.isAnalyzing = false;
    }
}

function displayResult(text) {
    elements.analysisContent.innerText = text;
    // 提取动作并展示
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
