/**
 * 德州扑克 AI 教练 - 协作版 (稳定性增强)
 */

const CONFIG = {
    GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    DS_URL: 'https://api.deepseek.com/chat/completions',
    DS_MODEL: 'deepseek-chat'
};

const state = {
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    dsKey: localStorage.getItem('ds_api_key') || '',
    videoStream: null,
    isAnalyzing: false
};

// 状态更新函数，确保 UI 能即时反馈
function updateStatus(text) {
    const statusEl = document.getElementById('currentStatus');
    if (statusEl) statusEl.innerText = text;
    console.log("Status Update:", text);
}

// 核心初始化逻辑
function initApp() {
    console.log("App Initializing...");
    
    const elements = {
        geminiInput: document.getElementById('geminiKey'),
        dsInput: document.getElementById('dsKey'),
        saveBtn: document.getElementById('saveKeys'),
        startCameraBtn: document.getElementById('startCamera'),
        captureBtn: document.getElementById('captureBtn')
    };

    // 1. 回填保存的 Key
    if (state.geminiKey) elements.geminiInput.value = state.geminiKey;
    if (state.dsKey) elements.dsInput.value = state.dsKey;
    
    // 2. 绑定保存按钮
    elements.saveBtn.onclick = () => {
        state.geminiKey = elements.geminiInput.value.trim();
        state.dsKey = elements.dsInput.value.trim();
        localStorage.setItem('gemini_api_key', state.geminiKey);
        localStorage.setItem('ds_api_key', state.dsKey);
        updateStatus('✅ Key 已成功保存');
    };

    // 3. 绑定功能按钮
    elements.startCameraBtn.onclick = startCamera;
    elements.captureBtn.onclick = captureAndAnalyze;

    updateStatus('🚀 系统准备就绪-V4');
}

// 确保在页面加载后执行
window.onload = initApp;

async function startCamera() {
    const video = document.getElementById('videoElement');
    const overlay = document.getElementById('videoOverlay');
    
    try {
        updateStatus('📸 正在申请摄像头权限...');
        state.videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 } }
        });
        video.srcObject = state.videoStream;
        if (overlay) overlay.classList.add('hidden');
        updateStatus('📷 摄像头已就绪');
    } catch (e) {
        updateStatus('❌ 权限失败: ' + e.message);
        alert('请确保使用 HTTPS 链接并允许摄像头访问');
    }
}

async function captureAndAnalyze() {
    if (!state.geminiKey || !state.dsKey) return alert('请先填入两个 Key 并保存');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('🔍 1/2: Gemini 正在看牌...');
    
    const canvas = document.getElementById('captureCanvas');
    const video = document.getElementById('videoElement');
    const analysisContent = document.getElementById('analysisContent');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
        // 步骤1：Gemini 识图
        const geminiRes = await fetch(`${CONFIG.GEMINI_URL}?key=${state.geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "请精准描述这张德州扑克图片：我的手牌是什么？公共牌是什么？底池筹码大约多少？只需提供事实。" },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });
        const geminiData = await geminiRes.json();
        if (geminiData.error) throw new Error('Gemini: ' + geminiData.error.message);
        const cardInfo = geminiData.candidates[0].content.parts[0].text;

        updateStatus('🧠 2/2: DeepSeek 正在决策...');

        // 步骤2：DeepSeek 分析
        const dsRes = await fetch(CONFIG.DS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.dsKey}`
            },
            body: JSON.stringify({
                model: CONFIG.DS_MODEL,
                messages: [
                    { role: "system", content: "你是一个专业的德州扑克专家。根据提供的牌局，给出建议动作（FOLD/CALL/RAISE）和深刻的逻辑理由。" },
                    { role: "user", content: `牌局：${cardInfo}` }
                ]
            })
        });
        const dsData = await dsRes.json();
        if (dsData.error) throw new Error('DeepSeek: ' + dsData.error.message);
        
        analysisContent.innerText = dsData.choices[0].message.content;
        updateStatus('✅ 分析完成');
    } catch (e) {
        updateStatus('❌ 错误: ' + e.message);
    } finally {
        state.isAnalyzing = false;
    }
}
