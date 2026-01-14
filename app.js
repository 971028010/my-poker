/**
 * 德州扑克 AI 教练 - 协作版 (路径彻底修复版)
 */

const state = {
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    dsKey: localStorage.getItem('ds_api_key') || '',
    videoStream: null,
    isAnalyzing: false
};

function updateStatus(text) {
    const statusEl = document.getElementById('currentStatus');
    if (statusEl) statusEl.innerText = text;
}

function initApp() {
    const geminiInput = document.getElementById('geminiKey');
    const dsInput = document.getElementById('dsKey');
    const saveBtn = document.getElementById('saveKeys');

    if (state.geminiKey) geminiInput.value = state.geminiKey;
    if (state.dsKey) dsInput.value = state.dsKey;
    
    saveBtn.onclick = () => {
        state.geminiKey = geminiInput.value.trim();
        state.dsKey = dsInput.value.trim();
        localStorage.setItem('gemini_api_key', state.geminiKey);
        localStorage.setItem('ds_api_key', state.dsKey);
        updateStatus('✅ Key 已成功保存');
    };

    document.getElementById('startCamera').onclick = startCamera;
    document.getElementById('captureBtn').onclick = captureAndAnalyze;

    updateStatus('🚀 系统准备就绪-V5');
}

window.onload = initApp;

async function startCamera() {
    try {
        state.videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 } }
        });
        document.getElementById('videoElement').srcObject = state.videoStream;
        document.getElementById('videoOverlay').classList.add('hidden');
        updateStatus('📷 摄像头已就绪');
    } catch (e) {
        updateStatus('❌ 摄像头错误: ' + e.message);
    }
}

async function captureAndAnalyze() {
    if (!state.geminiKey || !state.dsKey) return alert('请先填入两个 Key 并保存');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('🔍 1/2: Gemini 正在识别...');
    
    const canvas = document.getElementById('captureCanvas');
    const video = document.getElementById('videoElement');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // --- 核心修复：直接硬编码完整 URL，不使用任何变量拼接 ---
    const geminiFullUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.geminiKey}`;

    try {
        const geminiRes = await fetch(geminiFullUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "请精准列出：我的两张底牌、公共牌、目前的底池筹码。只需提供事实，不用分析。" },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });

        const geminiData = await geminiRes.json();
        if (geminiData.error) throw new Error(geminiData.error.message);
        const cardInfo = geminiData.candidates[0].content.parts[0].text;

        updateStatus('🧠 2/2: DeepSeek 正在决策...');

        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.dsKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: "system", content: "你是一个专业的德州扑克专家。根据提供的牌局，给出建议动作（FOLD/CALL/RAISE）和深刻的逻辑理由。" },
                    { role: "user", content: `牌局：${cardInfo}` }
                ]
            })
        });

        const dsData = await dsRes.json();
        if (dsData.error) throw new Error(dsData.error.message);
        
        document.getElementById('analysisContent').innerText = dsData.choices[0].message.content;
        updateStatus('✅ 分析完成');
    } catch (e) {
        updateStatus('❌ 错误: ' + e.message);
    } finally {
        state.isAnalyzing = false;
    }
}
