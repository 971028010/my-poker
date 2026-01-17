/**
 * 德州扑克语音 GTO 助手 - 重构版
 */

// --- 状态管理 ---
const state = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    history: [], // 本局的完整对话历史 (Text)
    pendingTranscripts: [], // 待发送的语音转录文本队列
    isRecording: false,
    mediaRecorder: null,
    audioChunks: []
};

// --- DOM 元素 ---
const dom = {
    recordBtn: document.getElementById('record-btn'),
    sendBtn: document.getElementById('send-gto-btn'),
    nextHandBtn: document.getElementById('next-hand-btn'),
    chatStream: document.getElementById('chat-stream'),
    pendingArea: document.getElementById('pending-area'),
    audioQueue: document.getElementById('audio-queue'),
    settingsBtn: document.getElementById('settings-btn'),
    keyModal: document.getElementById('key-modal'),
    keyInput: document.getElementById('api-key-input'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    streetBadge: document.getElementById('street-indicator')
};

// --- 初始化 ---
function init() {
    if (!state.apiKey) {
        dom.keyModal.classList.remove('hidden');
    }
    setupEventListeners();
}

// --- 事件监听 ---
function setupEventListeners() {
    // API Key 设置
    dom.saveKeyBtn.addEventListener('click', () => {
        const key = dom.keyInput.value.trim();
        if (key.startsWith('sk-')) {
            localStorage.setItem('openai_api_key', key);
            state.apiKey = key;
            dom.keyModal.classList.add('hidden');
        } else {
            alert('请输入有效的 OpenAI Key (sk-...)');
        }
    });

    dom.settingsBtn.addEventListener('click', () => {
        dom.keyModal.classList.remove('hidden');
        dom.keyInput.value = state.apiKey;
    });

    // 录音逻辑 (按住说话)
    // 兼容移动端 touch 事件
    dom.recordBtn.addEventListener('mousedown', startRecording);
    dom.recordBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });

    dom.recordBtn.addEventListener('mouseup', stopRecording);
    dom.recordBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

    // 发送 GTO 请求
    dom.sendBtn.addEventListener('click', processGTORequest);

    // 下一手牌
    dom.nextHandBtn.addEventListener('click', resetHand);
}

// --- 录音功能 ---
async function startRecording() {
    if (state.isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaRecorder = new MediaRecorder(stream);
        state.audioChunks = [];

        state.mediaRecorder.ondataavailable = event => {
            state.audioChunks.push(event.data);
        };

        state.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(state.audioChunks, { type: 'audio/mp3' }); // 或 webm
            await handleAudioInput(audioBlob);
        };

        state.mediaRecorder.start();
        state.isRecording = true;
        updateRecordBtnUI(true);
    } catch (err) {
        console.error("麦克风权限错误:", err);
        alert("无法访问麦克风，请检查权限设置");
    }
}

function stopRecording() {
    if (!state.isRecording) return;
    state.mediaRecorder.stop();
    state.isRecording = false;
    updateRecordBtnUI(false);
}

function updateRecordBtnUI(isRecording) {
    if (isRecording) {
        dom.recordBtn.classList.add('recording');
        dom.recordBtn.querySelector('.text').innerText = "松开 结束";
    } else {
        dom.recordBtn.classList.remove('recording');
        dom.recordBtn.querySelector('.text').innerText = "按住 说话";
    }
}

// --- 核心逻辑：语音转文字 + 队列管理 ---
async function handleAudioInput(blob) {
    // 1. 创建一个临时的“加载中”标签
    const tempId = Date.now();
    addPendingChip(tempId, "正在识别...", true);

    try {
        // 2. 发送给 Whisper API
        const text = await callWhisperAPI(blob);
        
        // 3. 更新标签内容
        if (text) {
            updatePendingChip(tempId, text);
            state.pendingTranscripts.push({ id: tempId, text: text });
            dom.pendingArea.classList.remove('pending-hidden'); // 显示队列区
        } else {
            removePendingChip(tempId);
        }
    } catch (error) {
        console.error(error);
        removePendingChip(tempId);
        alert("语音识别失败，请检查网络或 Key");
    }
}

// UI: 添加待发送的语音条
function addPendingChip(id, text, isLoading) {
    const chip = document.createElement('div');
    chip.className = 'audio-chip';
    chip.id = `chip-${id}`;
    chip.innerHTML = `
        <span class="chip-text">${text}</span>
        ${isLoading ? '⏳' : '<span class="delete-chip" onclick="deletePending(' + id + ')">✖</span>'}
    `;
    dom.audioQueue.appendChild(chip);
}

// UI: 更新语音条文字
function updatePendingChip(id, newText) {
    const chip = document.getElementById(`chip-${id}`);
    if (chip) {
        chip.innerHTML = `
            <span class="chip-text">"${newText}"</span>
            <span class="delete-chip" onclick="window.deletePending(${id})">✖</span>
        `;
    }
}

// UI: 删除语音条
function removePendingChip(id) {
    const chip = document.getElementById(`chip-${id}`);
    if (chip) chip.remove();
}

// 逻辑: 删除队列中的某一项 (挂载到 window 以便 onclick 调用)
window.deletePending = function(id) {
    state.pendingTranscripts = state.pendingTranscripts.filter(item => item.id !== id);
    removePendingChip(id);
    if (state.pendingTranscripts.length === 0) {
        dom.pendingArea.classList.add('pending-hidden');
    }
};

// --- 核心逻辑：请求 GTO 建议 ---
async function processGTORequest() {
    if (state.pendingTranscripts.length === 0) return;

    // 1. 合并所有文本
    const combinedText = state.pendingTranscripts.map(t => t.text).join("。");
    
    // 2. 清空队列 UI
    dom.audioQueue.innerHTML = '';
    state.pendingTranscripts = [];
    dom.pendingArea.classList.add('pending-hidden');

    // 3. 上屏显示用户的输入
    addBubble(combinedText, 'user');

    // 4. 添加 Loading 气泡
    const loadingId = addBubble("AI 正在思考...", 'ai');

    // 5. 构造 Prompt 并请求 GPT-4
    try {
        const response = await callGPT4(combinedText);
        // 6. 解析结果并显示
        updateBubble(loadingId, response);
        
        // 更新牌局阶段显示
        if (response.street) {
            dom.streetBadge.innerText = response.street;
        }

    } catch (error) {
        updateBubble(loadingId, { advice: { action: "Error", reasoning: "连接超时或 Key 余额不足" } });
    }
}

// --- API 调用封装 ---

// 1. OpenAI Whisper (语音转文字)
async function callWhisperAPI(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "input.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", "zh"); 
    // Prompt 增加德州术语识别率
    formData.append("prompt", "德州扑克术语: UTG, 枪口, 3-Bet, 4-Bet, Fold, Call, Check, All-in, BB, SB, 翻牌圈, 坚果, 杂色, 同花, 连张");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${state.apiKey}` },
        body: formData
    });

    const data = await res.json();
    return data.text;
}

// 2. OpenAI GPT-4 (策略分析)
async function callGPT4(newInput) {
    // 构造完整的 Message Chain
    const messages = [
        {
            role: "system",
            content: `你是一个德州扑克GTO专家。请严格以JSON格式输出。
            格式要求: {"street": "Flop", "advice": {"action": "Bet", "sizing": "33%", "reasoning": "简短理由"}}
            术语纠错: "枪口"=UTG, "3B"=3-Bet. 假设100bb深度。
            如果信息不全无法决策，action返回"Wait"。`
        },
        ...state.history, // 附带之前的上下文
        { role: "user", content: newInput }
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o", // 使用最新模型
            messages: messages,
            response_format: { type: "json_object" }
        })
    });

    const data = await res.json();
    const content = data.choices[0].message.content;
    
    // 存入历史，保持上下文连续
    state.history.push({ role: "user", content: newInput });
    state.history.push({ role: "assistant", content: content });

    return JSON.parse(content);
}

// --- UI 辅助函数 ---
function addBubble(text, type) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${type}`;
    bubble.id = `msg-${Date.now()}`;
    bubble.innerText = text;
    dom.chatStream.appendChild(bubble);
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
    return bubble.id;
}

function updateBubble(id, data) {
    const bubble = document.getElementById(id);
    if (!bubble) return;

    if (data.advice) {
        // 这是一个 AI 策略回复
        const { action, sizing, reasoning } = data.advice;
        bubble.innerHTML = `
            <span class="action-highlight">${action} ${sizing || ''}</span>
            <div class="reasoning">${reasoning}</div>
        `;
    } else {
        // 普通文本更新
        bubble.innerText = JSON.stringify(data);
    }
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
}

function resetHand() {
    state.history = [];
    state.pendingTranscripts = [];
    dom.chatStream.innerHTML = '<div class="system-msg">--- 新的一手牌 ---</div>';
    dom.streetBadge.innerText = 'Preflop';
    dom.pendingArea.classList.add('pending-hidden');
    dom.audioQueue.innerHTML = '';
}

// 启动
init();
