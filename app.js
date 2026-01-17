/**
 * 德州扑克语音 GTO 教练 - 修复配置版
 */

// --- 状态管理 ---
const state = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    // 默认配置
    gameConfig: JSON.parse(localStorage.getItem('poker_game_config')) || {
        sb: 1,
        bb: 2,
        players: 8, // 默认8人桌
        straddle: false,
        ante: 0
    },
    history: [], 
    pendingTranscripts: [], 
    isRecording: false,
    mediaRecorder: null,
    audioChunks: []
};

// --- DOM 获取 ---
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
    
    // 输入框 DOM
    apiKeyInput: document.getElementById('api-key-input'),
    sbInput: document.getElementById('sb-input'),
    bbInput: document.getElementById('bb-input'),
    playersInput: document.getElementById('players-input'), // 新增
    straddleInput: document.getElementById('straddle-toggle'),
    anteInput: document.getElementById('ante-input')
};

// --- 初始化 ---
function init() {
    // 强制绑定点击事件，防止 DOM 加载延迟问题
    setupEventListeners();
    
    if (!state.apiKey) {
        dom.keyModal.classList.remove('hidden');
    }
    updateStatusHeader();
}

// --- 事件监听 ---
function setupEventListeners() {
    // 1. 打开设置弹窗
    dom.settingsBtn.onclick = () => { // 使用 onclick 确保覆盖
        dom.keyModal.classList.remove('hidden');
        // 回填当前数据
        dom.apiKeyInput.value = state.apiKey;
        dom.sbInput.value = state.gameConfig.sb;
        dom.bbInput.value = state.gameConfig.bb;
        dom.playersInput.value = state.gameConfig.players || 8; // 回填人数
        dom.straddleInput.checked = state.gameConfig.straddle;
        dom.anteInput.value = state.gameConfig.ante;
    };

    // 2. 保存配置
    dom.saveKeyBtn.onclick = () => {
        const key = dom.apiKeyInput.value.trim();
        if (key && key.startsWith('sk-')) {
            localStorage.setItem('openai_api_key', key);
            state.apiKey = key;
        }

        const newConfig = {
            sb: Number(dom.sbInput.value) || 1,
            bb: Number(dom.bbInput.value) || 2,
            players: Number(dom.playersInput.value) || 8, // 保存人数
            straddle: dom.straddleInput.checked,
            ante: Number(dom.anteInput.value) || 0
        };
        
        state.gameConfig = newConfig;
        localStorage.setItem('poker_game_config', JSON.stringify(newConfig));

        dom.keyModal.classList.add('hidden');
        updateStatusHeader();
        alert("配置已生效");
    };

    // 3. 录音逻辑 (Touch/Mouse)
    const startHandler = (e) => { e.preventDefault(); startRecording(); };
    const stopHandler = (e) => { e.preventDefault(); stopRecording(); };

    dom.recordBtn.addEventListener('mousedown', startRecording);
    dom.recordBtn.addEventListener('mouseup', stopRecording);
    dom.recordBtn.addEventListener('touchstart', startHandler);
    dom.recordBtn.addEventListener('touchend', stopHandler);

    // 4. 业务操作
    dom.sendBtn.onclick = processGTORequest;
    dom.nextHandBtn.onclick = resetHand;
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
        alert("麦克风权限错误");
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

// --- Whisper ---
async function handleAudioInput(blob) {
    const tempId = Date.now();
    addPendingChip(tempId, "👂 听写中...", true);

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
        removePendingChip(tempId);
    }
}

// --- GTO Request (核心修改：注入人数参数) ---
async function processGTORequest() {
    if (state.pendingTranscripts.length === 0) return;

    const combinedText = state.pendingTranscripts.map(t => t.text).join("，");
    dom.audioQueue.innerHTML = '';
    state.pendingTranscripts = [];
    dom.pendingArea.classList.add('pending-hidden');

    addBubble(combinedText, 'user');
    const loadingId = addBubble("🧠 分析牌局与赔率...", 'ai');

    try {
        const response = await callGPT4(combinedText);
        updateBubble(loadingId, response);
        if (response.street) updateStatusHeader(response.street);
    } catch (error) {
        updateBubble(loadingId, { advice: { action: "Error", reasoning: "API 请求失败" } });
    }
}

// --- API Calls ---
async function callWhisperAPI(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "input.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", "zh");
    const glossary = "德州扑克术语: 红A, 黑A, 方A, 草A, UTG, 3B, 4B, Call, Check, Fold, All-in, 翻牌, 转牌, 河牌, 坚果, 杂色, 同花, 连张. 纠错: 黑头->黑桃";
    formData.append("prompt", glossary);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${state.apiKey}` },
        body: formData
    });
    const data = await res.json();
    return data.text;
}

// 核心修改：在 System Prompt 中加入 Players 信息
async function callGPT4(newInput) {
    const c = state.gameConfig;
    const gameContext = `
    当前设置: 
    - 盲注: ${c.sb}/${c.bb}
    - 玩家人数: ${c.players}人桌 (注意位置范围松紧)
    - 抓(Straddle): ${c.straddle?'开启 (Effective BB改变)':'关闭'}
    - 前注(Ante): ${c.ante}
    `;

    const messages = [
        {
            role: "system",
            content: `你是一个德州扑克GTO专家。请严格以JSON格式输出。
            
            # 环境参数
            ${gameContext}

            # 任务
            1. 识别术语与花色 (红/黑/方/草 -> h/s/d/c)。
            2. 输出 JSON: {"street": "...", "hero_hand": "...", "advice": {"action": "Check/Bet/Fold", "sizing": "数值", "reasoning": "简短理由"}}
            3. 如果用户只说了动作没说手牌，尝试推断或请求补充。
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

// --- UI Helpers ---
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
        bubble.innerHTML = `
            <span class="action-highlight">${data.advice.action} ${data.advice.sizing || ''}</span>
            <div class="reasoning">${data.advice.reasoning}</div>
        `;
    } else {
        bubble.innerText = JSON.stringify(data);
    }
    dom.chatStream.scrollTop = dom.chatStream.scrollHeight;
}

// 队列删除
function addPendingChip(id, text, isLoading) {
    const chip = document.createElement('div');
    chip.className = 'audio-chip';
    chip.id = `chip-${id}`;
    chip.innerHTML = `<span class="chip-text">${text}</span>${isLoading?'⏳':'<span class="delete-chip" onclick="window.deletePending('+id+')">✖</span>'}`;
    dom.audioQueue.appendChild(chip);
    dom.audioQueue.scrollLeft = dom.audioQueue.scrollWidth;
}
function updatePendingChip(id, t) {
    const chip = document.getElementById(`chip-${id}`);
    if(chip) chip.innerHTML = `<span class="chip-text">"${t}"</span><span class="delete-chip" onclick="window.deletePending(${id})">✖</span>`;
}
function removePendingChip(id) { document.getElementById(`chip-${id}`)?.remove(); }
window.deletePending = function(id) {
    state.pendingTranscripts = state.pendingTranscripts.filter(i => i.id !== id);
    removePendingChip(id);
    if (state.pendingTranscripts.length === 0) dom.pendingArea.classList.add('pending-hidden');
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
    // 更新左上角：显示人数
    dom.streetBadge.innerHTML = `${c.sb}/${c.bb}${straddleText} (${c.players}人) | ${currentStreet}`;
}

init();
