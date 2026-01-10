/**
 * 德州扑克 AI 教练 - 修复版
 * 解决了 WebSocket 握手失败和消息格式错误问题
 */

const CONFIG = {
    ANALYSIS_INTERVAL: 2000, 
    IMAGE_QUALITY: 0.6, // 降低质量以提高传输成功率
    IMAGE_MAX_WIDTH: 640,
    WS_URL: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent',
    MODEL: 'models/gemini-2.0-flash-exp',
    SYSTEM_INSTRUCTION: `你是一个专业的德州扑克教练。请识别画面中的：手牌、公共牌、底池。根据 GTO 策略给出回复：
【建议】: FOLD / CALL / CHECK / RAISE
【理由】: 简短解释。`
};

const state = {
    apiKey: localStorage.getItem('gemini_api_key') || '',
    ws: null,
    isConnected: false,
    isConnecting: false,
    videoStream: null,
    analysisTimer: null,
    analysisCount: 0,
    messageBuffer: '',
    pendingAnalysis: false
};

const elements = {
    apiKeyInput: document.getElementById('apiKey'),
    toggleKeyVisibility: document.getElementById('toggleKeyVisibility'),
    saveApiKey: document.getElementById('saveApiKey'),
    connectionStatus: document.getElementById('connectionStatus'),
    videoElement: document.getElementById('videoElement'),
    captureCanvas: document.getElementById('captureCanvas'),
    videoOverlay: document.getElementById('videoOverlay'),
    startCamera: document.getElementById('startCamera'),
    stopCamera: document.getElementById('stopCamera'),
    switchCamera: document.getElementById('switchCamera'),
    analysisContent: document.getElementById('analysisContent'),
    recommendationContent: document.getElementById('recommendationContent'),
    historyList: document.getElementById('historyList'),
    analysisCount: document.getElementById('analysisCount'),
    currentStatus: document.getElementById('currentStatus')
};

function init() {
    if (state.apiKey) elements.apiKeyInput.value = state.apiKey;
    elements.toggleKeyVisibility.addEventListener('click', toggleKeyVisibility);
    elements.saveApiKey.addEventListener('click', saveAndConnect);
    elements.startCamera.addEventListener('click', startCamera);
    elements.stopCamera.addEventListener('click', stopCamera);
    elements.switchCamera.addEventListener('click', () => {
        state.currentFacingMode = state.currentFacingMode === 'environment' ? 'user' : 'environment';
        startCamera();
    });
    updateStatus('待机');
}

function toggleKeyVisibility() {
    const input = elements.apiKeyInput;
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveAndConnect() {
    const apiKey = elements.apiKeyInput.value.trim();
    if (!apiKey) return alert('请输入 API Key');
    state.apiKey = apiKey;
    localStorage.setItem('gemini_api_key', apiKey);
    if (state.ws) state.ws.close();
    connectWebSocket();
}

// ============ 核心修复：WebSocket 逻辑 ============
async function connectWebSocket() {
    if (state.isConnecting) return;
    state.isConnecting = true;
    updateConnectionStatus('connecting', '连接中...');

    try {
        const wsUrl = `${CONFIG.WS_URL}?key=${state.apiKey}`;
        state.ws = new WebSocket(wsUrl);

        state.ws.onopen = () => {
            console.log('WS 连接打开，发送 Setup...');
            // 修复点 1：必须使用蛇形命名法 (generation_config)
            // 修复点 2：立即发送 setup 消息是建立会话的前提
            const setupMessage = {
                setup: {
                    model: CONFIG.MODEL,
                    generation_config: { response_modalities: ['TEXT'] },
                    system_instruction: { parts: [{ text: CONFIG.SYSTEM_INSTRUCTION }] }
                }
            };
            state.ws.send(JSON.stringify(setupMessage));
        };

        state.ws.onmessage = async (event) => {
            let data = JSON.parse(event.data instanceof Blob ? await event.data.text() : event.data);
            
            // 修复点 3：必须等到 setupComplete 才能发送图片
            if (data.setupComplete) {
                state.isConnected = true;
                state.isConnecting = false;
                updateConnectionStatus('connected', '已连接');
                updateStatus('连接就绪，开始分析');
                if (state.videoStream) startAnalysis();
                return;
            }
            handleServerMessage(data);
        };

        state.ws.onerror = () => {
            updateConnectionStatus('disconnected', '连接错误');
            state.isConnecting = false;
        };

        state.ws.onclose = (e) => {
            console.log(`连接关闭: ${e.code}`);
            state.isConnected = false;
            state.isConnecting = false;
            updateConnectionStatus('disconnected', e.code === 1008 ? 'Key 错误/无权' : '已断开');
            stopAnalysis();
        };
    } catch (e) { state.isConnecting = false; }
}

function handleServerMessage(data) {
    if (data.serverContent?.modelTurn) {
        const text = data.serverContent.modelTurn.parts[0].text;
        state.messageBuffer += text;
        displayAnalysis(state.messageBuffer);
    }
    if (data.serverContent?.turnComplete) {
        parseAndDisplayRecommendation(state.messageBuffer);
        addToHistory(state.messageBuffer);
        state.messageBuffer = '';
        state.pendingAnalysis = false;
        state.analysisCount++;
        elements.analysisCount.textContent = state.analysisCount;
    }
}

// ============ 图像捕获逻辑 ============
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: state.currentFacingMode || 'environment', width: 640, height: 480 }
        });
        state.videoStream = stream;
        elements.videoElement.srcObject = stream;
        elements.videoOverlay.classList.add('hidden');
        elements.startCamera.disabled = true;
        elements.stopCamera.disabled = false;
        if (state.isConnected) startAnalysis();
    } catch (e) { alert('摄像头启动失败: ' + e.message); }
}

function startAnalysis() {
    if (state.analysisTimer) return;
    state.analysisTimer = setInterval(() => {
        if (state.isConnected && state.videoStream && !state.pendingAnalysis) {
            captureAndAnalyze();
        }
    }, CONFIG.ANALYSIS_INTERVAL);
}

function captureAndAnalyze() {
    const canvas = elements.captureCanvas;
    const video = elements.videoElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const base64Data = canvas.toDataURL('image/jpeg', CONFIG.IMAGE_QUALITY).split(',')[1];
    
    // 修复点 4：实时输入必须符合 mediaChunks 嵌套格式
    const payload = {
        realtime_input: {
            media_chunks: [{ data: base64Data, mime_type: 'image/jpeg' }]
        }
    };
    state.ws.send(JSON.stringify(payload));
    state.pendingAnalysis = true;
    console.log('图像已发送');
}

// 其余 UI 辅助函数保持原样...
function updateConnectionStatus(s, t) {
    elements.connectionStatus.querySelector('.status-dot').className = `status-dot ${s}`;
    elements.connectionStatus.querySelector('.status-text').textContent = t;
}
function updateStatus(t) { elements.currentStatus.textContent = t; }
function stopAnalysis() { clearInterval(state.analysisTimer); state.analysisTimer = null; state.pendingAnalysis = false; }
function displayAnalysis(t) { elements.analysisContent.innerText = t; }
function parseAndDisplayRecommendation(t) {
    const match = t.match(/(FOLD|CALL|CHECK|RAISE)/i);
    const action = match ? match[0].toUpperCase() : 'WAIT';
    elements.recommendationContent.innerHTML = `<div class="action-badge ${action.toLowerCase()}">${action}</div>`;
}
function addToHistory(t) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<div class="time">${new Date().toLocaleTimeString()}</div><div class="action">${t.substring(0,30)}...</div>`;
    elements.historyList.prepend(item);
}

document.addEventListener('DOMContentLoaded', init);