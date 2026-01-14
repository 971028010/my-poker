/**
 * 德州扑克 AI 教练 - v11.1 (增强启动版)
 */

const state = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    isAnalyzing: false
};

function updateStatus(text) {
    const statusEl = document.getElementById('currentStatus');
    if (statusEl) {
        statusEl.innerText = text;
        console.log("Status:", text);
    }
}

// 使用监听器确保 HTML 完全加载后再运行
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, starting v11.1...");
    
    const input = document.getElementById('openAIKey');
    const saveBtn = document.getElementById('saveKeys');
    const startBtn = document.getElementById('startCamera');
    const captureBtn = document.getElementById('captureBtn');

    // 检查元素是否存在
    if (!input || !saveBtn || !startBtn || !captureBtn) {
        updateStatus('❌ 初始化失败：HTML 元素不匹配');
        return;
    }

    if (state.apiKey) input.value = state.apiKey;
    
    saveBtn.onclick = () => {
        state.apiKey = input.value.trim();
        localStorage.setItem('openai_api_key', state.apiKey);
        updateStatus('✅ Key 已保存');
    };

    startBtn.onclick = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            document.getElementById('videoElement').srcObject = stream;
            document.getElementById('videoOverlay').style.display = 'none';
            updateStatus('📷 摄像头就绪');
        } catch (e) { 
            updateStatus('❌ 摄像头错误'); 
        }
    };

    captureBtn.onclick = captureAndAnalyze;
    
    updateStatus('🚀 系统准备就绪-v11.1');
});

// ... captureAndAnalyze 函数保持不变 ...
