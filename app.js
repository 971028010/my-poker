/**
 * 德州扑克 AI 教练 - v11 OpenAI 满血版
 */

const state = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    isAnalyzing: false
};

function updateStatus(text) {
    const statusEl = document.getElementById('currentStatus');
    if (statusEl) statusEl.innerText = text;
}

window.onload = () => {
    const input = document.getElementById('openAIKey');
    // 自动回填保存的 Key
    if (state.apiKey) input.value = state.apiKey;
    
    // 绑定保存按钮
    document.getElementById('saveKeys').onclick = () => {
        state.apiKey = input.value.trim();
        localStorage.setItem('openai_api_key', state.apiKey);
        updateStatus('✅ OpenAI Key 已成功保存');
    };

    // 绑定开启摄像头
    document.getElementById('startCamera').onclick = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 } } 
            });
            document.getElementById('videoElement').srcObject = stream;
            document.getElementById('videoOverlay').classList.add('hidden');
            updateStatus('📷 摄像头就绪');
        } catch (e) { 
            updateStatus('❌ 摄像头错误: ' + e.message); 
        }
    };

    // 绑定分析按钮
    document.getElementById('captureBtn').onclick = captureAndAnalyze;
    updateStatus('🚀 系统准备就绪-v11 (GPT-4o)');
};

async function captureAndAnalyze() {
    if (!state.apiKey) return alert('请先输入 OpenAI API Key 并保存');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('🔍 GPT-4o 正在识图并计算策略...');

    const canvas = document.getElementById('captureCanvas');
    const video = document.getElementById('videoElement');
    
    // 确保画布尺寸与视频一致
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    // 转换为 OpenAI 要求的 Base64 格式
    const base64Image = canvas.toDataURL('image/jpeg', 0.7);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { 
                                type: "text", 
                                text: "你是一个专业的德州扑克 GTO 教练。请识别图中的手牌、公共牌和底池，给出建议动作(FOLD/CALL/CHECK/RAISE)及详细的逻辑理由。" 
                            },
                            { 
                                type: "image_url", 
                                image_url: { url: base64Image } 
                            }
                        ]
                    }
                ],
                max_tokens: 800
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        // 显示 AI 的回答
        document.getElementById('analysisContent').innerText = data.choices[0].message.content;
        updateStatus('✅ 策略生成成功');
    } catch (e) {
        console.error(e);
        updateStatus('❌ 失败: ' + e.message);
    } finally {
        state.isAnalyzing = false;
