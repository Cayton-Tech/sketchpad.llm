# sketchpad.llm

Turn plain-text requirements into diagrams using LLM-generated Mermaid.js code.

Sketchpad.llm is a minimal web tool that lets users describe diagrams in natural language and renders them using Mermaid. Powered by an LLM behind the scenes (like Gemini 1.5 Pro via Google AI Studio), it’s perfect for mocking up flowcharts, processes, system diagrams, and more—with zero drawing effort.

## Getting Started

1. Get an API Key
Visit Google AI Studio and generate an API key.

2. Clone or Fork This Repo
You can deploy it with GitHub Pages or use Netlify/Vercel if preferred.

3. Run the App
When prompted on load, paste your API key. It’ll be stored for the session only. The app will use it to query the LLM.

## How It Works

You type your idea (e.g., "a login flow with password reset and validation") in the prompt box.
The LLM is instructed (via a system prompt) to return clean, valid Mermaid.js code.
This code is passed to Mermaid.js in the browser, which renders the diagram on the fly.

## Features (MVP)

Clean, single-page layout: prompt box below, live diagram above

Session-based API key input (no backend required)

Works with Gemini via Google AI Studio

Tabbed viewer to switch between rendered diagram and Mermaid source

"Copy Mermaid Code" button for manual export

Export guidance for importing into draw.io or other tools

## Notes on Originality

This project was imagined and drafted without prior knowledge of similar tools like Eraser.io’s DiagramGPT or mermaidchart.com. It turns out—unsurprisingly—that this idea has been explored in several forms already. Still, this implementation is my own take, built for personal learning and experimentation. I came across those other tools only after sketchpad.llm was already underway. So while I’m late to the party, I still brought my own snacks.

## Future Ideas

Add support for model switching

Auto-layout refinements or styling

Save/load local sketches

Multi-step diagrams and versioning
