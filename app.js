/**
 * 德州扑克 AI 教练 - v9 Gemini 终极版
 */

const state = {
    apiKey: localStorage.getItem('gemini_api_key') || '',
    isAnalyzing: false
};

function updateStatus(text) {
    document.getElementById('currentStatus').innerText = text;
}

window.onload = () => {
    const input = document.getElementById('geminiKey');
    if (state.apiKey) input.value = state.apiKey;
    
    document.getElementById('saveKeys').onclick = () => {
        state.apiKey = input.value.trim();
        localStorage.setItem('gemini_api_key', state.apiKey);
        updateStatus('✅ Key 已保存');
    };

    document.getElementById('startCamera').onclick = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            document.getElementById('videoElement').srcObject = stream;
            document.getElementById('videoOverlay').classList.add('hidden');
            updateStatus('📷 摄像头就绪');
        } catch (e) { updateStatus('❌ 摄像头错误'); }
    };

    document.getElementById('captureBtn').onclick = captureAndAnalyze;
    updateStatus('🚀 系统准备就绪-v9');
};

async function captureAndAnalyze() {
    if (!state.apiKey) return alert('请输入 Gemini Key');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('🔍 正在识别牌局...');

    const canvas = document.getElementById('captureCanvas');
    const video = document.getElementById('videoElement');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // v9 核心：使用最标准的 API 路径
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "你是一个扑克专家。请识别图中的手牌和公共牌，给出建议动作(FOLD/CALL/RAISE)及简短理由。" },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        document.getElementById('analysisContent').innerText = data.candidates[0].content.parts[0].text;
        updateStatus('✅ 分析完成');
    } catch (e) {
        updateStatus('❌ 错误: ' + e.message);
    } finally {
        state.isAnalyzing = false;
    }
}
