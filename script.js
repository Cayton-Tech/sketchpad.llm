document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const apiKeyInput = document.getElementById('apiKey');
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const diagramContainer = document.getElementById('diagram-container');
    const diagramTab = document.getElementById('diagram-tab');
    const codeTab = document.getElementById('code-tab');
    const codeContainer = document.getElementById('code-container');
    const codeBlock = document.getElementById('code-block');
    const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
    const clearPromptBtn = document.getElementById('clear-prompt');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const fullscreenModal = document.getElementById('fullscreen-modal');
    const closeFullscreenBtn = document.getElementById('close-fullscreen');
    const fullscreenContent = document.getElementById('fullscreen-content');
    const toggleExamplesBtn = document.getElementById('toggle-examples');
    const examplesList = document.getElementById('examples-list');
    const exampleChips = document.querySelectorAll('.example-chip');
    const toastContainer = document.getElementById('toast-container');

    let currentMermaidCode = '';

    // --- Event Listeners ---
    generateBtn.addEventListener('click', handleGenerateClick);
    diagramTab.addEventListener('click', () => switchTab('diagram'));
    codeTab.addEventListener('click', () => switchTab('code'));
    toggleKeyVisibilityBtn.addEventListener('click', toggleKeyVisibility);
    clearPromptBtn.addEventListener('click', clearPrompt);
    copyCodeBtn.addEventListener('click', copyCodeToClipboard);
    fullscreenBtn.addEventListener('click', openFullscreen);
    closeFullscreenBtn.addEventListener('click', closeFullscreen);
    toggleExamplesBtn.addEventListener('click', toggleExamples);

    // Example chips
    exampleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            promptInput.value = prompt;
            promptInput.focus();
            showToast('success', 'Example loaded!', 'Click Generate to create your diagram');
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter or Cmd+Enter to generate
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleGenerateClick();
        }
        // Escape to close fullscreen
        if (e.key === 'Escape' && !fullscreenModal.classList.contains('hidden')) {
            closeFullscreen();
        }
    });

    // Close fullscreen on background click
    fullscreenModal.addEventListener('click', (e) => {
        if (e.target === fullscreenModal) {
            closeFullscreen();
        }
    });

    // --- Main Function to Handle Generation ---
    async function handleGenerateClick() {
        const apiKey = apiKeyInput.value.trim();
        const userPrompt = promptInput.value.trim();

        if (!apiKey) {
            showToast('error', 'API Key Required', 'Please enter your Google AI Studio API key to continue.');
            apiKeyInput.focus();
            return;
        }
        if (!userPrompt) {
            showToast('error', 'Prompt Required', 'Please describe the diagram you want to create.');
            promptInput.focus();
            return;
        }

        setLoadingState(true);
        switchTab('diagram');

        // Show loading state in diagram
        diagramContainer.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3em; margin-bottom: 16px;">⚡</div>
                <p class="empty-title">Generating your diagram...</p>
                <p class="empty-description">This should only take a moment</p>
            </div>
        `;

        try {
            const rawResponseText = await callGeminiApi(apiKey, userPrompt);
            const mermaidCode = extractMermaidCode(rawResponseText);
            await renderMermaidDiagram(mermaidCode);
            showToast('success', 'Diagram Generated!', 'Your diagram is ready to view');
        } catch (error) {
            diagramContainer.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 3em; margin-bottom: 16px; color: var(--error-color);">⚠️</div>
                    <p class="empty-title" style="color: var(--error-color);">Generation Failed</p>
                    <p class="empty-description">${error.message}</p>
                </div>
            `;
            showToast('error', 'Generation Failed', error.message);
            console.error('Error generating diagram:', error);
        } finally {
            setLoadingState(false);
        }
    }

    // --- API Call Function (Aligned with Gemini REST API Docs) ---
    async function callGeminiApi(apiKey, userPrompt) {
        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const systemInstruction = `
You are an expert in Mermaid.js syntax. Your task is to take a user's text description and convert it into valid, clean Mermaid.js code.
ONLY respond with the Mermaid code block. The code must be enclosed in a \`\`\`mermaid block.
Do not include any other text, explanations, or titles before or after the code block.
`;

        const requestBody = {
            "contents": [{ "parts": [{ "text": userPrompt }] }],
            "systemInstruction": { "parts": [{ "text": systemInstruction }] },
            "generationConfig": {
                "temperature": 0.2,
                "topK": 1,
                "topP": 1,
                "maxOutputTokens": 4096,
                "responseMimeType": "text/plain"
            }
        };

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            const errorMessage = errorBody.error?.message || 'Unknown API error';
            throw new Error(`API Error: ${errorMessage}`);
        }

        const responseData = await response.json();
        return responseData.candidates[0].content.parts[0].text;
    }

    // --- Mermaid Code Extraction Function ---
    function extractMermaidCode(responseText) {
        if (!responseText) return null;
        const match = responseText.match(/```mermaid\r?\n([\s\S]*?)\r?\n```/);
        return match ? match[1].trim() : null;
    }

    // --- Mermaid Rendering Function ---
    async function renderMermaidDiagram(mermaidCode) {
        if (!mermaidCode) {
            diagramContainer.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 3em; margin-bottom: 16px; color: var(--error-color);">⚠️</div>
                    <p class="empty-title" style="color: var(--error-color);">Invalid Response</p>
                    <p class="empty-description">Could not extract valid Mermaid code from the API response</p>
                </div>
            `;
            return;
        }

        currentMermaidCode = mermaidCode;
        codeBlock.textContent = mermaidCode;
        codeBlock.classList.remove('placeholder-text');

        // Show action buttons
        copyCodeBtn.classList.remove('hidden');
        fullscreenBtn.classList.remove('hidden');

        try {
            // Unique ID for Mermaid to render into
            const renderId = 'mermaid-graph-' + Date.now();
            const { svg } = await window.mermaid.render(renderId, mermaidCode);
            diagramContainer.innerHTML = svg;
        } catch (error) {
            diagramContainer.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 3em; margin-bottom: 16px; color: var(--error-color);">⚠️</div>
                    <p class="empty-title" style="color: var(--error-color);">Mermaid Syntax Error</p>
                    <p class="empty-description">${error.message}</p>
                    <details style="margin-top: 16px; text-align: left;">
                        <summary style="cursor: pointer; color: var(--primary-color);">View generated code</summary>
                        <pre style="margin-top: 8px; padding: 12px; background: var(--background-color); border-radius: var(--radius-sm); overflow: auto; font-size: 0.85em;">${mermaidCode}</pre>
                    </details>
                </div>
            `;
            console.error("Mermaid render error:", error);
        }
    }

    // --- UI Helper Functions ---
    function setLoadingState(isLoading) {
        generateBtn.disabled = isLoading;
        if (isLoading) {
            generateBtn.classList.add('loading');
        } else {
            generateBtn.classList.remove('loading');
        }
    }

    function switchTab(view) {
        if (view === 'diagram') {
            diagramTab.classList.add('active');
            codeTab.classList.remove('active');
            diagramContainer.classList.remove('hidden');
            codeContainer.classList.add('hidden');
            diagramTab.setAttribute('aria-selected', 'true');
            codeTab.setAttribute('aria-selected', 'false');
        } else {
            diagramTab.classList.remove('active');
            codeTab.classList.add('active');
            diagramContainer.classList.add('hidden');
            codeContainer.classList.remove('hidden');
            diagramTab.setAttribute('aria-selected', 'false');
            codeTab.setAttribute('aria-selected', 'true');
        }
    }

    function toggleKeyVisibility() {
        const type = apiKeyInput.type === 'password' ? 'text' : 'password';
        apiKeyInput.type = type;

        // Update icon
        const icon = type === 'password'
            ? '<path d="M10 4C5 4 1.73 7.11 1 10c.73 2.89 4 6 9 6s8.27-3.11 9-6c-.73-2.89-4-6-9-6zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>'
            : '<path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019 10C17.27 5.11 13.5 2 10 2c-1.084 0-2.128.214-3.104.612L3.707 2.293zM10 6a4 4 0 014 4c0 .368-.05.724-.143 1.064L11.064 8.857A3.99 3.99 0 0010 6zm-7.97 4.707l2.688 2.688A4 4 0 017 10c0-.368.05-.724.143-1.064L4.03 5.823C2.753 7.086 1.73 8.49 1 10z"/>';

        toggleKeyVisibilityBtn.querySelector('svg').innerHTML = icon;
    }

    function clearPrompt() {
        promptInput.value = '';
        promptInput.focus();
    }

    async function copyCodeToClipboard() {
        if (!currentMermaidCode) return;

        try {
            await navigator.clipboard.writeText(currentMermaidCode);
            showToast('success', 'Copied!', 'Mermaid code copied to clipboard');

            // Visual feedback on button
            const originalText = copyCodeBtn.innerHTML;
            copyCodeBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                </svg>
                <span class="btn-text-small">Copied!</span>
            `;

            setTimeout(() => {
                copyCodeBtn.innerHTML = originalText;
            }, 2000);
        } catch (error) {
            showToast('error', 'Copy Failed', 'Could not copy to clipboard');
        }
    }

    function openFullscreen() {
        if (!diagramContainer.querySelector('svg')) return;

        const svg = diagramContainer.innerHTML;
        fullscreenContent.innerHTML = svg;
        fullscreenModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeFullscreen() {
        fullscreenModal.classList.add('hidden');
        fullscreenContent.innerHTML = '';
        document.body.style.overflow = '';
    }

    function toggleExamples() {
        const isExpanded = toggleExamplesBtn.getAttribute('aria-expanded') === 'true';
        toggleExamplesBtn.setAttribute('aria-expanded', !isExpanded);
        examplesList.classList.toggle('collapsed');
    }

    // --- Toast Notification System ---
    function showToast(type = 'success', title, message) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
            error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
            warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
        };

        toast.innerHTML = `
            ${icons[type]}
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-message">${message}</div>` : ''}
            </div>
        `;

        toastContainer.appendChild(toast);

        // Remove after animation completes
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
});
