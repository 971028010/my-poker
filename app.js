/**
 * 德州扑克 AI 教练 - v8 纯 DeepSeek 满血版
 * 彻底摆脱 Gemini 路径报错困扰
 */

const state = {
    dsKey: localStorage.getItem('ds_api_key') || '',
    isAnalyzing: false
};

function updateStatus(text) {
    document.getElementById('currentStatus').innerText = text;
}

window.onload = () => {
    const dsInput = document.getElementById('dsKey');
    // 自动回填保存的 DS Key
    if (state.dsKey) dsInput.value = state.dsKey;
    
    document.getElementById('saveKeys').onclick = () => {
        state.dsKey = dsInput.value.trim();
        localStorage.setItem('ds_api_key', state.dsKey);
        updateStatus('✅ DeepSeek Key 已保存');
    };

    document.getElementById('startCamera').onclick = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 } } 
            });
            document.getElementById('videoElement').srcObject = stream;
            document.getElementById('videoOverlay').classList.add('hidden');
            updateStatus('📷 摄像头就绪');
        } catch (e) { updateStatus('❌ 摄像头错误'); }
    };

    document.getElementById('captureBtn').onclick = captureAndAnalyze;
    updateStatus('🚀 系统准备就绪-v8 (纯DS版)');
};

async function captureAndAnalyze() {
    if (!state.dsKey) return alert('请先输入 DeepSeek Key 并保存');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('🔍 DeepSeek 正在观察牌局...');

    const canvas = document.getElementById('captureCanvas');
    const video = document.getElementById('videoElement');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // DeepSeek 需要带 Data URL 前缀的图片格式
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${state.dsKey}` 
            },
            body: JSON.stringify({
                model: 'deepseek-chat', // 使用具备视觉识别能力的模型
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "你是一个德州扑克教练。请识别这张图片里的手牌和公共牌，并给出 GTO 策略建议（FOLD/CALL/RAISE）。" },
                            { type: "image_url", image_url: { url: base64Image } }
                        ]
                    }
                ],
                max_tokens: 1024
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        document.getElementById('analysisContent').innerText = data.choices[0].message.content;
        updateStatus('✅ 分析完成');
    } catch (e) {
        console.error(e);
        updateStatus('❌ 分析失败: ' + e.message);
    } finally {
        state.isAnalyzing = false;
    }
}
