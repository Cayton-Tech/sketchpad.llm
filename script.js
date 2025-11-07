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

    const toolbarButtons = [copyBtn, downloadBtn];
    const buttonFeedbackTimers = new WeakMap();
    const defaultCodePlaceholder = codeBlock.textContent;
    let latestSvgMarkup = '';

    // --- Event Listeners ---
    generateBtn.addEventListener('click', handleGenerateClick);
    diagramTab.addEventListener('click', () => switchTab('diagram'));
    codeTab.addEventListener('click', () => switchTab('code'));
    copyBtn.addEventListener('click', handleCopyClick);
    downloadBtn.addEventListener('click', handleDownloadClick);

    setToolbarState(false);

    // --- Main Function to Handle Generation ---
    async function handleGenerateClick() {
        const apiKey = apiKeyInput.value.trim();
        const userPrompt = promptInput.value.trim();

        if (!apiKey) {
            alert('Please enter your Google AI Studio API key.');
            return;
        }
        if (!userPrompt) {
            alert('Please enter a description for the diagram.');
            return;
        }

        setLoadingState(true);
        switchTab('diagram');
        showDiagramMessage('Generating diagram, please wait...', { preserveIllustration: true });
        resetCodeBlock();
        latestSvgMarkup = '';
        setToolbarState(false);

        try {
            const rawResponseText = await callGeminiApi(apiKey, userPrompt);
            const mermaidCode = extractMermaidCode(rawResponseText);
            await renderMermaidDiagram(mermaidCode);
        } catch (error) {
            showDiagramMessage(`Error: ${error.message}`, { isError: true });
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
            showDiagramMessage('Could not extract valid Mermaid code from the API response. The response may have been empty or in an unexpected format.', { isError: true });
            resetCodeBlock();
            setToolbarState(false);
            return;
        }

        codeBlock.textContent = mermaidCode;
        codeBlock.classList.remove('placeholder-text');

        try {
            // Unique ID for Mermaid to render into
            const renderId = 'mermaid-graph-' + Date.now();
            const { svg } = await window.mermaid.render(renderId, mermaidCode);
            latestSvgMarkup = svg;
            diagramContainer.innerHTML = svg;
            diagramContainer.classList.remove('is-empty');
            triggerDiagramAnimation();
            setToolbarState(true);
        } catch (error) {
            showDiagramMessage(`<strong>Mermaid Syntax Error:</strong><br>${error.message}`, { isError: true, preserveIllustration: false, allowHtml: true });
            latestSvgMarkup = '';
            setToolbarState(false);
            console.error("Mermaid render error:", error);
        }
    }

    // --- UI Helper Function ---
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
        });
    }

    function showDiagramMessage(message, { isError = false, preserveIllustration = true, allowHtml = false } = {}) {
        const content = allowHtml ? message : escapeHtml(message);
        const messageClass = isError ? 'placeholder-text error-message' : 'placeholder-text';
        diagramContainer.innerHTML = `<p class="${messageClass}">${content}</p>`;
        diagramContainer.classList.remove('has-diagram');
        latestSvgMarkup = '';
        if (preserveIllustration) {
            diagramContainer.classList.add('is-empty');
        } else {
            diagramContainer.classList.remove('is-empty');
        }
    }

    function resetCodeBlock() {
        codeBlock.textContent = defaultCodePlaceholder;
        codeBlock.classList.add('placeholder-text');
    }

    function triggerDiagramAnimation() {
        diagramContainer.classList.remove('has-diagram');
        // Force reflow so the animation retriggers on subsequent renders
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
        } catch (error) {
            console.error('Clipboard copy failed:', error);
            alert('Unable to copy the Mermaid code automatically. Please copy it manually.');
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
        } catch (error) {
            console.error('SVG download failed:', error);
            alert('Unable to download the SVG right now. Please try again.');
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
