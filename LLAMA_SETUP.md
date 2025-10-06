# LLAMA API Setup Instructions

This Chrome extension has been modified to use a local LLAMA API instead of OpenAI. Here's how to set it up:

## Prerequisites

1. **Install LLAMA**: You need to have LLAMA running on your local machine. You can use:
   - [Ollama](https://ollama.ai/) (recommended for easy setup)
   - [llama.cpp](https://github.com/ggerganov/llama.cpp)
   - Any other LLAMA-compatible API server

## Setup with Ollama (Recommended)

1. **Install Ollama**:
   ```bash
   # Download from https://ollama.ai/ or use:
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Pull a model**:
   ```bash
   ollama pull llama2
   # or try other models like:
   # ollama pull codellama
   # ollama pull mistral
   ```

3. **Start Ollama server**:
   ```bash
   ollama serve
   ```
   This will start the server at `http://localhost:11434` (default port).

## Setup with llama.cpp

1. **Clone and build llama.cpp**:
   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   cd llama.cpp
   make
   ```

2. **Start the server**:
   ```bash
   ./server -m your-model.gguf --port 11434
   ```

## Extension Configuration

1. **Load the extension** in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

2. **Configure the extension**:
   - Click the extension icon
   - Enter your LLAMA server URL (default: `http://localhost:11434`)
   - Optionally enter an API key if your server requires authentication
   - Click "Save Config"

3. **Test the connection**:
   - The extension will automatically test the connection
   - If successful, you'll see a green "✓ LLAMA API Connected & Saved!" message

## Usage

1. Navigate to any news article or webpage
2. Click the extension icon
3. Click "Analyze Political Bias"
4. The extension will extract the article content and send it to your local LLAMA server for analysis

## Troubleshooting

### Connection Issues
- Make sure your LLAMA server is running
- Check that the server URL is correct (default: `http://localhost:11434`)
- Verify that the server is accessible from your browser

### Model Issues
- Ensure you have a compatible model loaded
- The default model is `llama2` - change this in the code if needed
- Some models may work better than others for political bias analysis

### Performance Issues
- Local LLAMA servers can be slower than cloud APIs
- Consider using smaller, faster models for better performance
- Ensure you have sufficient RAM and CPU resources

## Security Notes

- All data stays on your local machine
- No external API calls are made
- Your article content is only sent to your local LLAMA server
- Configuration is stored locally in your browser

## Customization

You can modify the following in `popup.js`:
- Default model name (line 125)
- Default server URL (line 3)
- System prompt for bias analysis (line 115)
- Request parameters (temperature, max_tokens, etc.)

