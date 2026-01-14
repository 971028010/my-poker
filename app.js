/**
 * 德州扑克 AI 教练 - v12 OpenAI 深度联调版
 */

const state = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    isAnalyzing: false
};

// 核心功能：实时更新状态栏，并同步打印日志
function logStatus(msg, isError = false) {
    const statusEl = document.getElementById('currentStatus');
    if (statusEl) {
        statusEl.innerText = msg;
        statusEl.style.color = isError ? "#ff4d4d" : "#00ff88";
    }
    console.log(`[Status] ${msg}`);
}

window.onload = () => {
    const input = document.getElementById('openAIKey');
    if (state.apiKey) input.value = state.apiKey;
    
    document.getElementById('saveKeys').onclick = () => {
        state.apiKey = input.value.trim();
        localStorage.setItem('openai_api_key', state.apiKey);
        logStatus('✅ Key 已加密保存');
        alert("API Key 已保存至本地浏览器");
    };

    document.getElementById('startCamera').onclick = async () => {
        logStatus('正在请求摄像头权限...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1280 } } 
            });
            document.getElementById('videoElement').srcObject = stream;
            document.getElementById('videoOverlay').style.display = 'none';
            logStatus('📷 摄像头已就绪');
        } catch (e) { 
            logStatus('❌ 摄像头开启失败', true);
            alert("请检查浏览器摄像头权限设置");
        }
    };

    document.getElementById('captureBtn').onclick = captureAndAnalyze;
    logStatus('🚀 系统准备就绪-v12');
};

async function captureAndAnalyze() {
    if (!state.apiKey) return alert('请先输入并保存 OpenAI API Key');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    document.getElementById('analysisContent').innerText = "正在思考中...";

    try {
        // 步骤 1: 捕捉并压缩图片
        logStatus('📸 正在捕捉画面...');
        const canvas = document.getElementById('captureCanvas');
        const video = document.getElementById('videoElement');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        logStatus('⚙️ 正在压缩图像数据...');
        const base64Image = canvas.toDataURL('image/jpeg', 0.6); // 降低质量以提速

        // 步骤 2: 发起网络请求
        logStatus('🌐 正在建立 OpenAI 连接...');
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
                            { type: "text", text: "识别图中德州扑克的手牌和公共牌，给出建议动作(FOLD/CALL/RAISE)及详细理由。" },
                            { type: "image_url", image_url: { url: base64Image } }
                        ]
                    }
                ],
                max_tokens: 500
            })
        });

        // 步骤 3: 处理响应状态
        logStatus('📡 正在接收 AI 脑电波...');
        if (!response.ok) {
            const errorData = await response.json();
            const msg = errorData.error ? errorData.error.message : "网络连接被拒绝";
            throw new Error(msg);
        }

        const data = await response.json();
        const result = data.choices[0].message.content;
        
        document.getElementById('analysisContent').innerText = result;
        logStatus('✅ 分析完成');

    } catch (e) {
        console.error(e);
        logStatus('❌ 运行出错', true);
        // 弹出详细错误，直接定位问题
        alert(`分析失败原因：\n1. 网络问题（需检查VPN全局模式）\n2. Key错误或余额延迟\n\n具体报错信息：${e.message}`);
    } finally {
        state.isAnalyzing = false;
    }
}
