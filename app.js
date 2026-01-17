/**
 * 德州扑克 AI 教练 - v14 实战增强版
 */

const state = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    gameHistory: [],
    isAnalyzing: false
};

const elements = {
    video: document.getElementById('videoElement'),
    canvas: document.getElementById('captureCanvas'),
    previewLayer: document.getElementById('previewLayer'),
    previewImg: document.getElementById('previewImg'),
    loading: document.getElementById('loadingOverlay'),
    status: document.getElementById('currentStatus'),
    historyWall: document.getElementById('historyWall'),
    placeholder: document.getElementById('placeholder'),
    aiResponse: document.getElementById('aiResponse'),
    resAction: document.getElementById('resAction'),
    resSizing: document.getElementById('resSizing'),
    resReason: document.getElementById('resReason')
};

// 1. 初始化
window.onload = async () => {
    // 恢复 Key
    if (state.apiKey) document.getElementById('openAIKey').value = state.apiKey;
    
    // 启动高清摄像头
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        elements.video.srcObject = stream;
    } catch (err) {
        alert("摄像头启动失败: " + err.message);
    }

    // 绑定按钮
    document.getElementById('saveKey').onclick = saveApiKey;
    document.getElementById('captureBtn').onclick = takePhoto;
    document.getElementById('retakeBtn').onclick = () => elements.previewLayer.classList.add('hidden');
    document.getElementById('confirmBtn').onclick = confirmAndSend;
    document.getElementById('clearHistory').onclick = clearHistory;

    // 动作记录按钮绑定
    document.querySelectorAll('#actionSelectors button').forEach(btn => {
        btn.onclick = () => addHistory(btn.getAttribute('data-action'));
    });

    renderHistory();
};

function saveApiKey() {
    state.apiKey = document.getElementById('openAIKey').value.trim();
    localStorage.setItem('openai_api_key', state.apiKey);
    alert("Key 已保存！");
}

// 2. 核心拍照逻辑 (预览确认)
function takePhoto() {
    elements.canvas.width = elements.video.videoWidth;
    elements.canvas.height = elements.video.videoHeight;
    const ctx = elements.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(videoElement, 0, 0);
    
    // 采用高清 0.8 质量
    const dataUrl = elements.canvas.toDataURL('image/jpeg', 0.8);
    elements.previewImg.src = dataUrl;
    elements.previewLayer.classList.remove('hidden');
}

// 3. 发送 AI (精简指令 & 记忆墙)
async function confirmAndSend() {
    if (!state.apiKey) return alert("请先保存 OpenAI API Key");
    
    elements.previewLayer.classList.add('hidden');
    elements.loading.classList.remove('hidden');
    
    const base64Image = elements.previewImg.src.split(',')[1];
    
    // 构造极简 GTO 指令
    const prompt = `
        你是一个德州扑克 GTO 专家。
        牌局背景记忆：${state.gameHistory.length > 0 ? state.gameHistory.join(' -> ') : '新牌局开始'}。
        任务：识别图片中我的手牌和公共牌，结合背景给出当前最优行动。
        必须严格按 JSON 格式回答：
        {
            "action": "动作名(仅限 FOLD/CALL/CHECK/RAISE/ALL-IN)",
            "sizing": "具体下注额(如 8.5 BB，若为 FOLD 则填 0)",
            "range": "上下浮动范围(如 ±1.2 BB)",
            "reason": "一句话核心逻辑(不超 30 字)"
        }
    `;

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                }],
                response_format: { type: "json_object" }
            })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const result = JSON.parse(data.choices[0].message.content);

        // 更新 UI
        elements.resAction.innerText = result.action;
        elements.resSizing.innerHTML = `${result.sizing} <span class="text-xs text-slate-500 font-normal">${result.range}</span>`;
        elements.resReason.innerText = result.reason;

        elements.placeholder.classList.add('hidden');
        elements.aiResponse.classList.remove('hidden');
    } catch (err) {
        alert("分析出错: " + err.message);
    } finally {
        elements.loading.classList.add('hidden');
    }
}

// 4. 历史记录管理
function addHistory(action) {
    state.gameHistory.push(action);
    renderHistory();
}

function clearHistory() {
    state.gameHistory = [];
    renderHistory();
    elements.aiResponse.classList.add('hidden');
    elements.placeholder.classList.remove('hidden');
}

function renderHistory() {
    elements.historyWall.innerHTML = state.gameHistory.map(h => `
        <div class="px-2 py-1 bg-slate-700 rounded text-[10px] text-slate-300 border border-slate-600">${h}</div>
    `).join('') + (state.gameHistory.length === 0 ? '<div class="text-[10px] text-slate-600 italic">等待录入动作...</div>' : '');
}
