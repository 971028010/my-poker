/**
 * 德州扑克 AI 教练 - Gemini识图 + DeepSeek大脑版
 */

const CONFIG = {
    GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    DS_URL: 'https://api.deepseek.com/chat/completions',
    DS_MODEL: 'deepseek-chat'
};

const state = {
    geminiKey: localStorage.getItem('gemini_api_key') || '',
    dsKey: localStorage.getItem('ds_api_key') || '',
    videoStream: null,
    isAnalyzing: false
};

const elements = {
    // 假设你在 HTML 里增加了 dsKey 的输入框，如果没有，可以直接在代码里写死
    currentStatus: document.getElementById('currentStatus'),
    videoElement: document.getElementById('videoElement'),
    captureCanvas: document.getElementById('captureCanvas'),
    analysisContent: document.getElementById('analysisContent')
};

// ...（初始化和启动摄像头的代码保持不变）...

async function captureAndAnalyze() {
    // 这里建议你直接把 dsKey 填入，或者在 HTML 增加一个输入框
    if (!state.geminiKey || !state.dsKey) return alert('请确保 Gemini Key 和 DeepSeek Key 都已保存');
    if (state.isAnalyzing) return;
    
    state.isAnalyzing = true;
    updateStatus('🔍 第一步：Gemini 正在识别画面...');

    // 1. 拍照并转为 Base64
    const canvas = elements.captureCanvas;
    const video = elements.videoElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
        // 第一步：让 Gemini 把图片转成文字描述
        const geminiRes = await fetch(`${CONFIG.GEMINI_URL}?key=${state.geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "请精准描述这张德州扑克图片：我的手牌是什么？公共牌是什么？底池筹码大约多少？只需列出信息，不用分析。" },
                        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });
        const geminiData = await geminiRes.json();
        const tableInfo = geminiData.candidates[0].content.parts[0].text;

        updateStatus('🧠 第二步：DeepSeek 正在计算 GTO 策略...');

        // 第二步：把文字信息发给 DeepSeek 进行逻辑分析
        const dsRes = await fetch(CONFIG.DS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.dsKey}`
            },
            body: JSON.stringify({
                model: CONFIG.DS_MODEL,
                messages: [
                    { role: "system", content: "你是一个专业的德州扑克 GTO 教练。我会给你牌局信息，请给出：建议动作（FOLD/CALL/RAISE）和理由。" },
                    { role: "user", content: `当前牌局如下：${tableInfo}` }
                ]
            })
        });
        const dsData = await dsRes.json();
        const advice = dsData.choices[0].message.content;

        elements.analysisContent.innerText = advice;
        updateStatus('✅ 分析完成');
    } catch (e) {
        updateStatus('❌ 失败: ' + e.message);
    } finally {
        state.isAnalyzing = false;
    }
}
