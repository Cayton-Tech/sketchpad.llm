document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const apiKeyInput = document.getElementById('apiKey');
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const diagramContainer = document.getElementById('diagram-container');

    // --- Event Listener ---
    generateBtn.addEventListener('click', handleGenerateClick);

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
        diagramContainer.innerHTML = '<p class="placeholder-text">Generating diagram, please wait...</p>';

        try {
            const rawResponseText = await callGeminiApi(apiKey, userPrompt);
            const mermaidCode = extractMermaidCode(rawResponseText);
            await renderMermaidDiagram(mermaidCode);
        } catch (error) {
            diagramContainer.innerHTML = `<p class="placeholder-text" style="color: var(--error-color);">Error: ${error.message}</p>`;
            console.error('Error generating diagram:', error);
        } finally {
            setLoadingState(false);
        }
    }

    // --- API Call Function (Aligned with Gemini REST API Docs) ---
    async function callGeminiApi(apiKey, userPrompt) {
        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

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
        const match = responseText.match(/```mermaid\n([\s\S]*?)\n```/);
        return match ? match[1].trim() : null;
    }
    
    // --- Mermaid Rendering Function ---
    async function renderMermaidDiagram(mermaidCode) {
        if (!mermaidCode) {
            diagramContainer.innerHTML = `<p class="placeholder-text" style="color: var(--error-color);">Could not extract valid Mermaid code from the API response. The response may have been empty or in an unexpected format.</p>`;
            return;
        }
        
        try {
            // Unique ID for Mermaid to render into
            const renderId = 'mermaid-graph-' + Date.now();
            const { svg } = await window.mermaid.render(renderId, mermaidCode);
            diagramContainer.innerHTML = svg;
        } catch (error) {
            diagramContainer.innerHTML = `<p class="placeholder-text" style="color: var(--error-color);"><strong>Mermaid Syntax Error:</strong><br>${error.message}</p><pre>${mermaidCode}</pre>`;
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
});
