/**
 * 德州扑克语音 GTO 教练 - 完整增强版
 */

// --- 状态管理 ---
const state = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    gameConfig: JSON.parse(localStorage.getItem('poker_game_config')) || {
        sb: 1,
        bb: 2,
        straddle: false,
        ante: 0
    },
    history: [], 
    pendingTranscripts: [], 
    isRecording: false,
    mediaRecorder: null,
    audioChunks: []
};

// --- DOM ---
const dom = {
    recordBtn: document.getElementById('record-btn'),
    sendBtn: document.getElementById('send-gto-btn'),
    nextHandBtn: document.getElementById('next-hand-btn'),
    chatStream: document.getElementById('chat-stream'),
    pendingArea: document.getElementById('pending-area'),
    audioQueue: document.getElementById('audio-queue'),
    settingsBtn: document.getElementById('settings-btn'),
    keyModal: document.getElementById('key-modal'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    streetBadge: document.getElementById('street-indicator'),
    // Settings Inputs
    apiKeyInput: document.getElementById('api-key-input'),
    sbInput: document.getElementById('sb-input'),
    bbInput: document.getElementById('bb-input'),
    straddleInput: document.getElementById('straddle-toggle'),
    anteInput: document.getElementById('ante-input')
};

// --- 初始化 ---
function init() {
    if (!state.apiKey) {
        dom.keyModal.classList.remove('hidden');
    }
    updateStatusHeader();
    setupEventListeners();
}

// --- 事件监听 ---
function setupEventListeners() {
    // 1. 设置保存
    dom.saveKeyBtn.addEventListener('click', () => {
        const key = dom.apiKeyInput.value.trim();
        if (key && key.startsWith('sk-')) {
            localStorage.setItem('openai_api_key', key);
            state.apiKey = key;
        }

        const newConfig = {
            sb: Number(dom.sbInput.value) || 1,
            bb: Number(dom.bbInput.value) || 2,
            straddle: dom.straddleInput.checked,
            ante: Number(dom.anteInput.value) || 0
        };
        
        state.gameConfig = newConfig;
        localStorage.setItem('poker_game_config', JSON.stringify(newConfig));

        dom.keyModal.classList.add('hidden');
        updateStatusHeader();
    });

    // 2. 打开设置
    dom.settingsBtn.addEventListener('click', () => {
        dom.keyModal.classList.remove('hidden');
        dom.apiKeyInput.value = state.apiKey;
        dom.sbInput.value = state.gameConfig.sb;
        dom.bbInput.value = state.gameConfig.bb;
        dom.straddleInput.checked = state.gameConfig.straddle;
        dom.anteInput.value = state.gameConfig.ante;
    });

    // 3. 录音控制 (兼容 Touch)
    const startHandler = (e) => { e.preventDefault(); startRecording(); };
    const stopHandler = (e) => { e.preventDefault(); stopRecording(); };

    dom.recordBtn.addEventListener('mousedown', startRecording);
    dom.recordBtn.addEventListener('mouseup', stopRecording);
    dom.recordBtn.addEventListener('touchstart', startHandler);
    dom.recordBtn.addEventListener('touchend', stopHandler);

    // 4. 业务操作
    dom.sendBtn.addEventListener('click', processGTORequest);
    dom.nextHandBtn.addEventListener('click', resetHand);
}

// --- 录音流程 ---
async function startRecording() {
    if (state.isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.mediaRecorder = new MediaRecorder(stream);
        state.audioChunks = [];

        state.mediaRecorder.ondataavailable = event => state.audioChunks.push(event.data);
        state.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(state.audioChunks, { type: 'audio/mp3' });
            await handleAudioInput(audioBlob);
        };

        state.mediaRecorder.start();
        state.isRecording = true;
        updateRecordBtnUI(true);
    } catch (err) {
        alert("麦克风权限被拒绝，请检查浏览器设置");
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

// --- Whisper 识别 + 队列管理 ---
async function handleAudioInput(blob) {
    const tempId = Date.now();
    addPendingChip(tempId, "正在识别...", true);

    try {
        const text = await callWhisperAPI(blob);
        if (text) {
            updatePendingChip(tempId, text);
            state.pendingTranscripts.push({ id: tempId, text: text });
            dom.pendingArea.classList.remove('pending-hidden');
        } else {
            removePendingChip(tempId);
        }
    } catch (error) {
        console.error(error);
        removePendingChip(tempId);
        addBubble("⚠️ 语音识别失败，请检查网络或 Key", "system");
    }
}

// --- GTO 核心请求 ---
async function processGTORequest() {
    if (state.pendingTranscripts.length === 0) return;

    // 合并文本
    const combinedText = state.pendingTranscripts.map(t => t.text).join("，");
    
    // 清空 UI 队列
    dom.audioQueue.innerHTML = '';
    state.pendingTranscripts = [];
    dom.pendingArea.classList.add('pending-hidden');

    // 显示用户气泡
    addBubble(combinedText, 'user');
    const loadingId = addBubble("🧠 AI 正在思考策略...", 'ai');

    try {
        const response = await callGPT4(combinedText);
        updateBubble(loadingId, response);
        
        // 更新牌局阶段
        if (response.street) {
            updateStatusHeader(response.street);
        }
    } catch (error) {
        console.error(error);
        updateBubble(loadingId, { advice: { action: "Error", reasoning: "请求超时或 API 额度不足，请检查设置。" } });
    }
}

// --- OpenAI API 调用 ---

// 1. Whisper (带词库)
async function callWhisperAPI(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "input.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", "zh");
    // 强化关键词库
    const glossary = "德州扑克术语: 红A, 黑A, 方A, 草A, 红K, 黑Q, 方J, 草T. 枪口, UTG, 3B, 4B, Call, Check, Fold, All-in. 比如: 翻牌, 转牌, 河牌, 坚果, 杂色, 同花, 连张. 纠错: 黑头->黑桃";
    formData.append("prompt", glossary);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${state.apiKey}` },
        body: formData
    });
    const data = await res.json();
    return data.text;
}

// 2. GPT-4 (带上下文设置)
async function callGPT4(newInput) {
    const config = state.gameConfig;
    const gameContext = `
    当前设置: 盲注${config.sb}/${config.bb}, 抓(Straddle): ${config.straddle?'是':'否'}, 前注:${config.ante}。
    请根据此盲注结构计算赔率和加注尺度。
    `;

    const messages = [
        {
            role: "system",
            content: `你是一个德州扑克GTO专家。请严格以JSON格式输出。
            
            # 环境
            ${gameContext}

            # 核心指令
            1. 识别简称：红/黑/方/草 -> 对应花色(h/s/d/c)。
            2. 智能纠错：识别语音转录错误。
            3. 输出格式(JSON Only)：
               {"street": "Turn", "hero_hand": "AhKd", "board": ["Ts", "9c", "2h"], "advice": {"action": "Check", "sizing": "0", "reasoning": "简短战术理由"}}
            4. 视角：始终以 Hero 为第一人称。
            `
        },
        ...state.history,
        { role: "user", content: newInput }
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: messages,
            response_format: { type: "json_object" }
        })
    });

    const data = await res.json();
    const content = data.choices[0].message.content;
    
    state.history.push({ role: "user", content: newInput });
    state.history.push({ role: "assistant", content: content });

    return JSON.parse(content);
}

// --- UI 辅助功能 ---

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
        const { action, sizing, reasoning } = data.advice;
        bubble.innerHTML = `
            <span class="action-highlight">${action} ${sizing !== '0' && sizing ? sizing : ''}</span>
            <div class="reasoning">${reasoning}</div>
        `;
    } else {
        bubble.innerText = "解析错误: " + JSON.stringify(data);
    }
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
}

// 队列 UI 管理
function addPendingChip(id, text, isLoading) {
    const chip = document.createElement('div');
    chip.className = 'audio-chip';
    chip.id = `chip-${id}`;
    chip.innerHTML = `
        <span class="chip-text">${text}</span>
        ${isLoading ? '⏳' : '<span class="delete-chip" onclick="window.deletePending(' + id + ')">✖</span>'}
    `;
    dom.audioQueue.appendChild(chip);
    dom.audioQueue.scrollLeft = dom.audioQueue.scrollWidth;
}

function updatePendingChip(id, newText) {
    const chip = document.getElementById(`chip-${id}`);
    if (chip) {
        chip.innerHTML = `
            <span class="chip-text">"${newText}"</span>
            <span class="delete-chip" onclick="window.deletePending(${id})">✖</span>
        `;
    }
}

function removePendingChip(id) {
    const chip = document.getElementById(`chip-${id}`);
    if (chip) chip.remove();
}

// 暴露给全局的删除函数
window.deletePending = function(id) {
    state.pendingTranscripts = state.pendingTranscripts.filter(item => item.id !== id);
    removePendingChip(id);
    if (state.pendingTranscripts.length === 0) {
        dom.pendingArea.classList.add('pending-hidden');
    }
};

function resetHand() {
    state.history = [];
    state.pendingTranscripts = [];
    dom.chatStream.innerHTML = '<div class="system-msg">--- 新的一手牌 ---</div>';
    updateStatusHeader('Preflop');
    dom.pendingArea.classList.add('pending-hidden');
    dom.audioQueue.innerHTML = '';
}

function updateStatusHeader(street) {
    const c = state.gameConfig;
    const straddleText = c.straddle ? ' <span style="color:#e74c3c;font-size:12px">抓</span>' : '';
    const currentStreet = street || 'Preflop';
    dom.streetBadge.innerHTML = `${c.sb}/${c.bb}${straddleText} <span style="opacity:0.6
