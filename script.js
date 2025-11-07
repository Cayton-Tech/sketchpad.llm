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
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const statusBanner = document.getElementById('status-banner');
    const apiKeyMessage = document.getElementById('api-key-message');
    const promptMessage = document.getElementById('prompt-message');
    const promptCharacterCount = document.getElementById('prompt-character-count');
    const promptChips = Array.from(document.querySelectorAll('[data-prompt-chip]'));

    const toolbarButtons = [copyBtn, downloadBtn];
    const buttonFeedbackTimers = new WeakMap();
    const fieldRegistry = {
        apiKey: {
            input: apiKeyInput,
            message: apiKeyMessage,
            container: apiKeyInput.closest('.form-field')
        },
        prompt: {
            input: promptInput,
            message: promptMessage,
            container: promptInput.closest('.form-field')
        }
    };
    const defaultCodePlaceholder = codeBlock.textContent;
    const loadingMessages = [
        'Sketching your nodes and edges...',
        'Polishing Mermaid syntax...',
        'Rendering a crisp preview...'
    ];

    let latestSvgMarkup = '';
    let loadingIntervalId = null;
    let loadingMessageIndex = 0;
    let statusTimeoutId = null;

    // --- Event Listeners ---
    generateBtn.addEventListener('click', handleGenerateClick);
    diagramTab.addEventListener('click', () => switchTab('diagram'));
    codeTab.addEventListener('click', () => switchTab('code'));
    copyBtn.addEventListener('click', handleCopyClick);
    downloadBtn.addEventListener('click', handleDownloadClick);
    promptInput.addEventListener('input', () => {
        updateCharacterCount();
        clearFieldMessage('prompt');
    });
    apiKeyInput.addEventListener('input', () => clearFieldMessage('apiKey'));

    promptChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const samplePrompt = chip.dataset.prompt || chip.textContent || '';
            promptInput.value = samplePrompt;
            updateCharacterCount();
            clearFieldMessage('prompt');
            promptInput.focus({ preventScroll: true });
            showStatus('info', 'Sample prompt loaded—tweak it and generate when ready!', { persist: false });
        });
    });

    setToolbarState(false);
    updateCharacterCount();

    // --- Main Function to Handle Generation ---
    async function handleGenerateClick() {
        const apiKey = apiKeyInput.value.trim();
        const userPrompt = promptInput.value.trim();

        clearFieldMessage('apiKey');
        clearFieldMessage('prompt');

        if (!apiKey) {
            setFieldMessage('apiKey', 'Please enter your Google AI Studio API key.', 'error');
            showStatus('warning', 'Add your API key to generate diagrams.', { persist: true });
            apiKeyInput.focus({ preventScroll: true });
            return;
        }
        if (!userPrompt) {
            setFieldMessage('prompt', 'Describe the diagram so we know what to build.', 'error');
            showStatus('warning', 'Add a prompt to generate your diagram.', { persist: true });
            promptInput.focus({ preventScroll: true });
            return;
        }

        setLoadingState(true);
        switchTab('diagram');
        showDiagramMessage('Generating diagram, please wait...', { preserveIllustration: true });
        resetCodeBlock();
        latestSvgMarkup = '';
        setToolbarState(false);
        startLoadingCycle();

        try {
            const rawResponseText = await callGeminiApi(apiKey, userPrompt);
            const mermaidCode = extractMermaidCode(rawResponseText);
            await renderMermaidDiagram(mermaidCode);
        } catch (error) {
            stopLoadingCycle();
            showDiagramMessage(`Error: ${error.message}`, { isError: true, preserveIllustration: false });
            showStatus('error', error.message || 'Something went wrong while generating the diagram.', { persist: true });
            setToolbarState(false);
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
            throw new Error(`API Error: ${response.status}. ${errorBody.error?.message || 'Check console for details.'}`);
        }

        const responseData = await response.json();
        return responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
            stopLoadingCycle();
            showDiagramMessage('Could not extract valid Mermaid code from the API response. The response may have been empty or in an unexpected format.', { isError: true, preserveIllustration: false });
            showStatus('error', 'The response did not include Mermaid code. Try refining your prompt.', { persist: true });
            resetCodeBlock();
            setToolbarState(false);
            return;
        }

        codeBlock.textContent = mermaidCode;
        codeBlock.classList.remove('placeholder-text');

        try {
            const renderId = 'mermaid-graph-' + Date.now();
            const { svg } = await window.mermaid.render(renderId, mermaidCode);
            latestSvgMarkup = svg;
            diagramContainer.innerHTML = svg;
            diagramContainer.classList.remove('is-empty');
            diagramContainer.classList.add('has-diagram');
            triggerDiagramAnimation();
            setToolbarState(true);
            stopLoadingCycle();
            showStatus('success', 'Diagram ready! Copy or download it from the toolbar.', { persist: false });
            setFieldMessage('prompt', 'Need tweaks? Update the prompt and generate again.', 'success');
        } catch (error) {
            stopLoadingCycle();
            showDiagramMessage(`<strong>Mermaid Syntax Error:</strong><br>${error.message}`, { isError: true, preserveIllustration: false, allowHtml: true });
            latestSvgMarkup = '';
            setToolbarState(false);
            showStatus('error', 'Mermaid could not render the diagram. Fix the prompt or try again.', { persist: true });
            console.error('Mermaid render error:', error);
        }
    }

    // --- UI Helper Functions ---
    function setLoadingState(isLoading) {
        generateBtn.disabled = isLoading;
        if (isLoading) {
            generateBtn.classList.add('loading');
            generateBtn.textContent = 'Generating...';
        } else {
            generateBtn.classList.remove('loading');
            generateBtn.textContent = 'Generate Diagram';
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

    function setToolbarState(enabled) {
        toolbarButtons.forEach((button) => {
            if (!button) return;
            button.disabled = !enabled;
            if (!enabled) {
                button.classList.remove('toolbar-button--success');
                if (button.dataset.originalText) {
                    button.textContent = button.dataset.originalText;
                }
            }
        });
    }

    function showDiagramMessage(message, { isError = false, preserveIllustration = true, allowHtml = false } = {}) {
        const content = allowHtml ? message : escapeHtml(message);
        const messageClass = isError ? 'placeholder-text error-message' : 'placeholder-text';
        if (preserveIllustration) {
            diagramContainer.innerHTML = `
                <div class="diagram-empty-illustration" aria-hidden="true">
                    <span class="diagram-empty-node"></span>
                    <span class="diagram-empty-node"></span>
                    <span class="diagram-empty-connector"></span>
                </div>
                <p class="${messageClass}">${content}</p>`;
            diagramContainer.classList.add('is-empty');
        } else {
            diagramContainer.innerHTML = `<p class="${messageClass}">${content}</p>`;
            diagramContainer.classList.remove('is-empty');
        }
        diagramContainer.classList.remove('has-diagram');
        latestSvgMarkup = '';
    }

    function resetCodeBlock() {
        codeBlock.textContent = defaultCodePlaceholder;
        codeBlock.classList.add('placeholder-text');
    }

    function triggerDiagramAnimation() {
        diagramContainer.classList.remove('has-diagram');
        void diagramContainer.offsetWidth;
        diagramContainer.classList.add('has-diagram');
    }

    async function handleCopyClick() {
        if (copyBtn.disabled || codeBlock.classList.contains('placeholder-text')) {
            return;
        }

        const mermaidCode = codeBlock.textContent;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(mermaidCode);
            } else {
                fallbackCopyText(mermaidCode);
            }
            showTemporaryFeedback(copyBtn, 'Copied!');
            showStatus('success', 'Mermaid code copied to your clipboard.', { persist: false });
        } catch (error) {
            console.error('Clipboard copy failed:', error);
            showStatus('error', 'Unable to copy automatically. Please copy the code manually.', { persist: true });
        }
    }

    function fallbackCopyText(text) {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = text;
        tempTextArea.setAttribute('readonly', '');
        tempTextArea.style.position = 'absolute';
        tempTextArea.style.left = '-9999px';
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
    }

    function handleDownloadClick() {
        if (downloadBtn.disabled || !latestSvgMarkup) {
            return;
        }

        try {
            const svgContent = latestSvgMarkup.trim().startsWith('<?xml')
                ? latestSvgMarkup
                : `<?xml version="1.0" encoding="UTF-8"?>\n${latestSvgMarkup}`;
            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `sketchpad-diagram-${Date.now()}.svg`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            showTemporaryFeedback(downloadBtn, 'Saved!');
            showStatus('success', 'SVG downloaded to your device.', { persist: false });
        } catch (error) {
            console.error('SVG download failed:', error);
            showStatus('error', 'Unable to download the SVG right now. Please try again.', { persist: true });
        }
    }

    function showTemporaryFeedback(button, message) {
        const originalText = button.dataset.originalText || button.textContent;
        button.dataset.originalText = originalText;
        button.textContent = message;
        button.classList.add('toolbar-button--success');

        if (buttonFeedbackTimers.has(button)) {
            clearTimeout(buttonFeedbackTimers.get(button));
        }

        const timeoutId = setTimeout(() => {
            button.textContent = button.dataset.originalText;
            button.classList.remove('toolbar-button--success');
        }, 1600);

        buttonFeedbackTimers.set(button, timeoutId);
    }

    function startLoadingCycle() {
        stopLoadingCycle();
        loadingMessageIndex = 0;
        showStatus('info', loadingMessages[loadingMessageIndex], { persist: true });
        loadingIntervalId = setInterval(() => {
            loadingMessageIndex = (loadingMessageIndex + 1) % loadingMessages.length;
            showStatus('info', loadingMessages[loadingMessageIndex], { persist: true });
        }, 2400);
    }

    function stopLoadingCycle() {
        if (loadingIntervalId) {
            clearInterval(loadingIntervalId);
            loadingIntervalId = null;
        }
    }

    function showStatus(type, message, { persist = false } = {}) {
        if (!statusBanner) return;
        statusBanner.textContent = message;
        statusBanner.className = `status-banner status-${type}`;
        statusBanner.hidden = false;

        if (statusTimeoutId) {
            clearTimeout(statusTimeoutId);
            statusTimeoutId = null;
        }

        if (!persist) {
            statusTimeoutId = setTimeout(() => {
                hideStatus();
            }, 4500);
        }
    }

    function hideStatus() {
        if (!statusBanner) return;
        statusBanner.hidden = true;
        statusBanner.textContent = '';
        statusBanner.className = 'status-banner';
    }

    function setFieldMessage(fieldKey, message, state) {
        const field = fieldRegistry[fieldKey];
        if (!field) return;
        field.message.textContent = message || '';
        if (state) {
            field.message.dataset.state = state;
        } else {
            delete field.message.dataset.state;
        }
        if (state === 'error') {
            field.container.classList.add('has-error');
        } else {
            field.container.classList.remove('has-error');
        }
    }

    function clearFieldMessage(fieldKey) {
        setFieldMessage(fieldKey, '', null);
    }

    function updateCharacterCount() {
        const count = promptInput.value.length;
        promptCharacterCount.textContent = count ? `${count} character${count === 1 ? '' : 's'}` : '';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
