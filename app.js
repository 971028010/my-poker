/**
 * 德州扑克 AI 教练 - v7 自动纠错版
 */

const state = {
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    dsKey: localStorage.getItem('ds_api_key') || '',
    isAnalyzing: false
};

function updateStatus(text) {
    document.getElementById('currentStatus').innerText = text;
}

window.onload = () => {
    const geminiInput = document.getElementById('geminiKey');
    const dsInput = document.getElementById('dsKey');
    if (state.geminiKey) geminiInput.value = state.geminiKey;
    if (state.dsKey) dsInput.value = state.dsKey;
    
    document.getElementById('saveKeys').onclick = () => {
        state.geminiKey = geminiInput.value.trim();
        state.dsKey = dsInput.value.trim();
        localStorage.setItem('gemini_api_key', state.geminiKey);
        localStorage.setItem('ds_api_key', state.dsKey);
        updateStatus('✅ Key 已保存');
    };

    document.getElementById('startCamera').onclick = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            document.getElementById('videoElement').srcObject = stream;
            document.getElementById('videoOverlay').classList.add('hidden');
            updateStatus('📷 摄像头就绪');
        } catch (e) { updateStatus('❌ 摄像头错误'); }
    };

    document.getElementById('captureBtn').onclick = captureAndAnalyze;
    updateStatus('🚀 系统准备就绪-v7');
};

async function captureAndAnalyze() {
    if (!state.geminiKey || !state.dsKey) return alert('请先保存 Key');
    if (state.isAnalyzing) return;
    state.isAnalyzing = true;
    updateStatus('🔍 正在尝试识别...');

    const canvas = document.getElementById('captureCanvas');
    const video = document.getElementById('videoElement');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // 备选路径列表：尝试所有可能的 Google 模型路径格式
    const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.geminiKey}`,
        `https://generativelanguage.googleapis.com/v1beta/gemini-1.5-flash:generateContent?key=${state.geminiKey}`
    ];

    let cardInfo = "";
    for (let url of endpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "列出底牌和公共牌" }, { inline_data: { mime_type: "image/jpeg", data: base64Image } }] }] })
            });
            const data = await res.json();
            if (data.candidates) {
                cardInfo = data.candidates[0].content.parts[0].text;
                break; // 成功则跳出循环
            }
        } catch (e) { console.log("尝试路径失败，换下一个..."); }
    }

    if (!cardInfo) {
        state.isAnalyzing = false;
        return updateStatus('❌ Gemini 所有路径均失效，请检查 VPN 节点或 Key');
    }

    updateStatus('🧠 DeepSeek 决策中...');
    try {
        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.dsKey}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: "user", content: "你是扑克专家，分析这局牌：" + cardInfo }] })
        });
        const dsData = await dsRes.json();
        document.getElementById('analysisContent').innerText = dsData.choices[0].message.content;
        updateStatus('✅ 分析完成');
    } catch (e) { updateStatus('❌ DeepSeek 失败'); }
    state.isAnalyzing = false;
}
