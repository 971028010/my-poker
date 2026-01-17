/**
 * 德州扑克 AI 教练 - v14 实战增强版逻辑
 * 处理摄像头采集、拍照预览、历史记忆及 OpenAI API 请求
 */

const state = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    gameHistory: [],
    isAnalyzing: false
};

const dom = {
    video: document.getElementById('videoElement'),
    canvas: document.getElementById('captureCanvas'),
    previewLayer: document.getElementById('previewLayer'),
    previewImg: document.getElementById('previewImg'),
    loading: document.getElementById('loadingOverlay'),
    historyWall: document.getElementById('historyWall'),
    placeholder: document.getElementById('placeholder'),
    aiResponse: document.getElementById('aiResponse'),
    status: document.getElementById('statusIndicator'),
    resOpponent: document.getElementById('resOpponent'),
    resAction: document.getElementById('resAction'),
    resSizing: document.getElementById('resSizing'),
    resReason: document.getElementById('resReason')
};

// 1. 初始化摄像头与事件绑定
window.onload = async () => {
    // 自动回填已保存的 Key
    if (state.apiKey) document.getElementById('openAIKey').value = state.apiKey;
    
    // 启动高清摄像头
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment', 
                width: { ideal: 1920 }, 
                height: { ideal: 1080 } 
            } 
        });
        dom.video.srcObject = stream;
        updateStatus("已连接高清源");
    } catch (err) {
        updateStatus("摄像头错误", true);
        console.error("Camera access denied:", err);
    }

    // 按钮事件监听
    document.getElementById('saveKey').onclick = saveApiKey;
    document.getElementById('captureBtn').onclick = takePhoto;
    
    // 重拍逻辑：隐藏预览层，重置分析状态
    document.getElementById('retakeBtn').onclick = () => {
        dom.previewLayer.classList.add('hidden');
        state.isAnalyzing = false;
        updateStatus("就绪");
    };
    
    document.getElementById('confirmBtn').onclick = confirmAndSend;
    document.getElementById('clearHistory').onclick = clearHistory;

    // 对手动作快速记录按钮绑定
    document.querySelectorAll('#actionSelectors button').forEach(btn => {
        btn.onclick = () => addHistory(btn.getAttribute('data-action'));
    });

    renderHistory();
};

/**
 * 更新界面状态显示
 */
function updateStatus(msg, isError = false) {
    if (!dom.status) return;
    dom.status.innerText = msg;
    dom.status.style.color = isError ? "#f87171" : "#64748b";
}

/**
 * 保存 API Key 到本地缓存
 */
function saveApiKey() {
    const keyInput = document.getElementById('openAIKey');
    const key = keyInput.value.trim();
    if (!key.startsWith('sk-')) {
        alert("请输入以 sk- 开头的有效 OpenAI 密钥");
        return;
    }
    state.apiKey = key;
    localStorage.setItem('openai_api_key', key);
    updateStatus("密钥已更新");
    alert("密钥已安全保存至浏览器本地");
}

/**
 * 拍照并进入预览确认模式
 */
function takePhoto() {
    if (state.isAnalyzing) return;

    // 同步 Canvas 尺寸与视频真实分辨率
    dom.canvas.width = dom.video.videoWidth;
    dom.canvas.height = dom.video.videoHeight;
    const ctx = dom.canvas.getContext('2d');
    
    // 开启高清抗锯齿
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(dom.video, 0, 0);
    
    // 生成 JPEG 预览图 (0.85 质量平衡)
    const dataUrl = dom.canvas.toDataURL('image/jpeg', 0.85);
    dom.previewImg.src = dataUrl;
    dom.previewLayer.classList.remove('hidden');
    updateStatus("等待发送确认...");
}

/**
 * 核心：发送图像和记忆链至 OpenAI
 */
async function confirmAndSend() {
    if (!state.apiKey) {
        alert("请先输入并保存 OpenAI API Key");
        return;
    }
    if (state.isAnalyzing) return;
    
    // 锁定状态，防止重复点击
    state.isAnalyzing = true;
    dom.previewLayer.classList.add('hidden');
    dom.loading.classList.remove('hidden');
    updateStatus("AI 深度分析中...");
    
    // 提取 Base64 纯数据
    const base64Image = dom.previewImg.src.split(',')[1];
    
    // 构造具备“记忆”的 Prompt
    const prompt = `
        你是一个德州扑克 GTO 实战教练。
        本局历史路径记录：${state.gameHistory.length > 0 ? state.gameHistory.join(' -> ') : '新牌局开始'}。
        
        请分析图片并：
        1. 简要分析当前对手的行为动机或局势（20字内）。
        2. 给出当前最优的 GTO 动作建议。
        
        必须且只能按以下 JSON 格式返回：
        {
            "opponent_analysis": "分析对手当前处境或可能的倾向",
            "action": "FOLD/CALL/CHECK/RAISE/ALL-IN",
            "sizing": "建议下注额(如 8.5 BB，FOLD填0)",
            "range": "建议波动范围(如 ±1.0 BB)",
            "reason": "一句话核心决策逻辑理由(30字内)"
        }
    `;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        // 解析 AI 返回的 JSON 策略
        const result = JSON.parse(data.choices[0].message.content);

        // 更新 UI 结果
        dom.resOpponent.innerText = result.opponent_analysis;
        dom.resAction.innerText = result.action;
        dom.resSizing.innerHTML = `${result.sizing} <span class="text-xs text-slate-500 font-normal">${result.range}</span>`;
        dom.resReason.innerText = result.reason;

        dom.placeholder.classList.add('hidden');
        dom.aiResponse.classList.remove('hidden');
        updateStatus("分析完成");

    } catch (err) {
        console.error("API Request Error:", err);
        updateStatus("请求失败", true);
        alert("分析出错，请检查网络（VPN）或 API Key 余额。");
    } finally {
        // 关键：无论成功或失败，重置加载状态和分析锁，防止卡死
        dom.loading.classList.add('hidden');
        state.isAnalyzing = false;
    }
}

/**
 * 记录局内对手动作
 */
function addHistory(action) {
    state.gameHistory.push(action);
    renderHistory();
    updateStatus("已记录动作: " + action);
}

/**
 * 清空当局牌局记忆
 */
function clearHistory() {
    state.gameHistory = [];
    renderHistory();
    dom.aiResponse.classList.add('hidden');
    dom.placeholder.classList.remove('hidden');
    updateStatus("牌局记忆已清空");
}

/**
 * 渲染顶部记忆墙
 */
function renderHistory() {
    const wall = dom.historyWall;
    if (!wall) return;
    
    if (state.gameHistory.length === 0) {
        wall.innerHTML = '<div class="text-[10px] text-slate-600 italic">等待录入动作...</div>';
    } else {
        wall.innerHTML = state.gameHistory.map(h => `
            <div class="px-2 py-1 bg-slate-700 rounded text-[10px] text-slate-300 border border-slate-600 animate-in fade-in zoom-in duration-200">
                ${h}
            </div>
        `).join('') + '<div class="px-2 py-1 bg-white/5 rounded text-[10px] text-slate-500 italic">Next...</div>';
    }
}
