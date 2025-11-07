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

    // --- Event Listeners ---
    generateBtn.addEventListener('click', handleGenerateClick);
    diagramTab.addEventListener('click', () => switchTab('diagram'));
    codeTab.addEventListener('click', () => switchTab('code'));

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
            diagramContainer.innerHTML = `<p class="placeholder-text" style="color: var(--error-color);">Could not extract valid Mermaid code from the API response. The response may have been empty or in an unexpected format.</p>`;
            return;
        }

        codeBlock.textContent = mermaidCode;
        codeBlock.classList.remove('placeholder-text');

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
  });
