// API key storage with security
let apiKey = null;
let apiUrl = 'http://127.0.0.1:11434'; // Default LLAMA API URL
let isKeyValid = false;

// Load API key from storage with error handling
function loadApiKey() {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['llama_api_key', 'llama_api_url'], (result) => {
        console.log('Loading API configuration from storage:', result);
        apiKey = result.llama_api_key;
        apiUrl = result.llama_api_url || 'http://127.0.0.1:11434';
        if (apiUrl) {
          isKeyValid = validateApiKey(apiUrl);
          console.log('API configuration loaded, valid:', isKeyValid);
        }
        updateUI();
      });
    } else {
      console.error('Chrome storage API not available');
      updateUI();
    }
  } catch (error) {
    console.error('Error loading API key from storage:', error);
    updateUI();
  }
}

// Load API key when popup opens
loadApiKey();

// Add diagnostic button functionality
document.addEventListener('DOMContentLoaded', () => {
  const diagnosticBtn = document.getElementById('diagnosticBtn');
  if (diagnosticBtn) {
    diagnosticBtn.addEventListener('click', async () => {
      await runDiagnostics();
    });
  }
});

// Diagnostic function to help troubleshoot connection issues
async function runDiagnostics() {
  const msgElement = document.getElementById('msg');
  msgElement.innerHTML = '<div style="color: blue;">Running diagnostics...</div>';
  
  let diagnostics = [];
  
  try {
    // Test 1: Basic connectivity
    diagnostics.push('🔍 Testing basic connectivity...');
    const response1 = await fetch(`${apiUrl}/api/tags`, { method: 'GET' });
    diagnostics.push(`✅ Basic connectivity: ${response1.status} ${response1.statusText}`);
    
    // Test 2: Check available models
    if (response1.ok) {
      const data = await response1.json();
      diagnostics.push(`📋 Available models: ${data.models ? data.models.length : 'unknown'}`);
      if (data.models && data.models.length > 0) {
        diagnostics.push(`📝 Models: ${data.models.map(m => m.name).join(', ')}`);
      }
    }
    
    // Test 3: Test multiple chat endpoints
    diagnostics.push('💬 Testing chat endpoints...');
    const endpoints = [
      { name: 'Ollama Chat', url: `${apiUrl}/api/chat` },
      { name: 'Generate', url: `${apiUrl}/api/generate` },
      { name: 'OpenAI Compatible', url: `${apiUrl}/v1/chat/completions` }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const chatResponse = await fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3:latest',
            messages: [{ role: 'user', content: 'test' }],
            stream: false
          })
        });
        diagnostics.push(`✅ ${endpoint.name}: ${chatResponse.status} ${chatResponse.statusText}`);
      } catch (error) {
        diagnostics.push(`❌ ${endpoint.name}: ${error.message}`);
      }
    }
    
  } catch (error) {
    diagnostics.push(`❌ Error: ${error.message}`);
  }
  
  msgElement.innerHTML = `
    <div style="border: 1px solid #ddd; padding: 10px; border-radius: 5px; background: #f9f9f9;">
      <h4 style="margin: 0 0 10px 0; color: #333;">🔧 Connection Diagnostics</h4>
      <div style="font-family: monospace; font-size: 11px; line-height: 1.4;">
        ${diagnostics.join('<br>')}
      </div>
      <div style="margin-top: 10px; font-size: 10px; color: #666;">
        <strong>Server URL:</strong> ${apiUrl}<br>
        <strong>Timestamp:</strong> ${new Date().toLocaleString()}
      </div>
    </div>
  `;
}

// Validate API configuration (for LLAMA API, we'll accept localhost URLs or any non-empty string)
function validateApiKey(key) {
  if (!key || typeof key !== 'string') return false;
  // For LLAMA API, accept localhost URLs
  if (key.startsWith('http://localhost:') || key.startsWith('https://localhost:')) {
    return true;
  }
  // Otherwise, accept any non-empty string as an API key
  return key.length > 0;
}

// Mask API key for display
function maskApiKey(key) {
  if (!key || key.length < 8) return key;
  return key.substring(0, 8) + '•'.repeat(key.length - 8);
}

document.getElementById('btn').addEventListener('click', async () => {
  if (!apiUrl || !isKeyValid) {
    document.getElementById('msg').innerHTML = `
      <div style="color: red; margin-bottom: 10px;">
        <strong>LLAMA API Configuration Required:</strong><br>
        Please enter a valid LLAMA server URL above.<br>
        <small style="color: #666;">Default server: http://localhost:11434</small>
      </div>
    `;
    return;
  }

  try {
    document.getElementById('msg').innerHTML = '<div style="color: blue;">Analyzing article for political bias...</div>';
    
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on a valid page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
      document.getElementById('msg').innerHTML = `
        <div style="color: red;">
          <strong>Invalid Page:</strong><br>
          Please navigate to a news article or webpage to analyze.
        </div>
      `;
      return;
    }
    
    // Send message to content script to get article content
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getArticleContent' });
    
    if (response && response.articleContent) {
      await analyzePoliticalBias(response.articleContent);
    } else {
      document.getElementById('msg').textContent = 'No article content found on this page';
    }
  } catch (error) {
    console.error('Error analyzing article:', error);
    console.log('Full error object:', error);
    console.log('Error stack:', error.stack);
    
    // Handle specific connection errors
    if (error.message.includes('Could not establish connection') || error.message.includes('Receiving end does not exist')) {
      console.log('Content script connection error detected');
      document.getElementById('msg').innerHTML = `
        <div style="color: red;">
          <strong>Content Script Not Loaded:</strong><br>
          Please refresh the page and try again.<br>
          <small style="color: #666;">The extension needs to reload its content script.</small>
        </div>
      `;
    } else {
      console.log('General error in article analysis:', error.message);
      document.getElementById('msg').innerHTML = `
        <div style="color: red;">
          <strong>Error:</strong> ${error.message}
        </div>
      `;
    }
  }
});
async function analyzePoliticalBias(articleContent) {
  const systemPrompt = `You are a political bias rating assistant. Your job is to analyze text and determine if it leans left or right politically. 
                          You must always output percentages that add up to 100%, in this exact format:
                          - Left leaning: X%
                          - Right leaning: Y%
                          Do not explain or add any extra text. Just return the percentages.`;

  const userPrompt = `Analyze the following article and provide the left vs. right leaning percentages:
          Title: ${articleContent.title}
          Text: ${articleContent.text}`;

  const endpoints = [
    {
      url: `${apiUrl}/api/chat`,
      body: {
        model: 'llama3:latest', // explicitly use llama3:latest
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false
      }
    },
    {
      url: `${apiUrl}/api/generate`,
      body: {
        model: 'llama3:latest',
        prompt: `${systemPrompt}\n\nUser: ${userPrompt}\nAssistant:`,
        stream: false
      }
    }
  ];
  console.log(endpoints);

  let lastError = null;

  for (let i = 0; i < endpoints.length; i++) {
    const { url, body } = endpoints[i];
    try {
      console.log(`Trying endpoint ${i + 1}/${endpoints.length}: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      console.log(`Endpoint ${i + 1} response:`, response.status, response.statusText);

      if (!response.ok) {
        lastError = new Error(`Endpoint ${i + 1} failed: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      // Determine response content
      const analysis = data.message?.content || data.response || null;

      if (!analysis) {
        lastError = new Error(`Unexpected response format from endpoint ${i + 1}`);
        continue;
      }

      displayBiasAnalysis(analysis, articleContent);
      return;

    } catch (error) {
      lastError = error;
      console.log(`Endpoint ${i + 1} error:`, error.message);
    }
  }

  // All endpoints failed
  console.error('All LLaMA API endpoints failed:', lastError);

  let errorMessage = `<strong>LLAMA API Error:</strong><br>${lastError.message}<br>`;

  if (lastError.message.includes('403')) {
    errorMessage += `
      <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 3px; font-size: 11px;">
        <strong>403 Forbidden - Troubleshooting:</strong><br>
        • Ensure Ollama is running: <code>ollama serve</code><br>
        • Check server accessibility: <code>curl ${apiUrl}/api/chat</code><br>
        • Restart Ollama: <code>ollama stop && ollama serve</code><br>
        • Verify model is loaded: <code>ollama list</code><br>
        • Try a different port if needed: <code>ollama serve --port 11435</code>
      </div>
    `;
  } else {
    errorMessage += `<small>Make sure your LLaMA server is running at ${apiUrl}</small>`;
  }

  document.getElementById('msg').innerHTML = `<div style="color: red;">${errorMessage}</div>`;
}

// Parse percentages from LLAMA response
function parseBiasPercentages(analysis) {
  console.log('Parsing bias analysis:', analysis);
  
  // Extract percentages using regex
  const leftMatch = analysis.match(/left.*?(\d+)%/i);
  const rightMatch = analysis.match(/right.*?(\d+)%/i);
  
  let leftPercent = 0;
  let rightPercent = 0;
  
  if (leftMatch) {
    leftPercent = parseInt(leftMatch[1]);
  }
  if (rightMatch) {
    rightPercent = parseInt(rightMatch[1]);
  }
  
  // If percentages don't add up to 100, normalize them
  const total = leftPercent + rightPercent;
  if (total > 0) {
    leftPercent = Math.round((leftPercent / total) * 100);
    rightPercent = Math.round((rightPercent / total) * 100);
  }
  
  console.log('Parsed percentages - Left:', leftPercent, 'Right:', rightPercent);
  
  return { left: leftPercent, right: rightPercent };
}

// Create donut chart
function createBiasChart(leftPercent, rightPercent) {
  const ctx = document.getElementById('biasChart');
  if (!ctx) {
    console.error('Chart canvas not found');
    return;
  }
  
  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library not loaded');
    document.getElementById('msg').innerHTML += `
      <div style="color: red; margin-top: 10px;">
        <strong>Chart Error:</strong> Chart.js library failed to load. Showing text results only.
      </div>
    `;
    return;
  }
  
  // Destroy existing chart if it exists
  if (window.biasChartInstance) {
    window.biasChartInstance.destroy();
  }
  
  try {
    window.biasChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Left Leaning', 'Right Leaning'],
      datasets: [{
        data: [leftPercent, rightPercent],
        backgroundColor: ['#3498db', '#e74c3c'], // Blue for left, Red for right
        borderColor: ['#2980b9', '#c0392b'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + context.parsed + '%';
            }
          }
        }
      },
      cutout: '60%'
    }
  });
  } catch (error) {
    console.error('Error creating chart:', error);
    document.getElementById('msg').innerHTML += `
      <div style="color: red; margin-top: 10px;">
        <strong>Chart Creation Error:</strong> ${error.message}
      </div>
    `;
  }
}

function displayBiasAnalysis(analysis, articleContent) {
  const msgElement = document.getElementById('msg');
  const chartContainer = document.getElementById('chartContainer');
  
  // Parse the percentages
  const percentages = parseBiasPercentages(analysis);
  
  let html = `
    <div style="border: 1px solid #ddd; padding: 10px; border-radius: 5px; background: #f9f9f9;">
      <h4 style="margin: 0 0 10px 0; color: #333;">Political Bias Analysis</h4>
      <div style="font-size: 12px; color: #666; margin-top: 10px;">
        <strong>Article:</strong> ${articleContent.title}<br>
        <strong>URL:</strong> <a href="${articleContent.url}" target="_blank" style="color: #0066cc;">${articleContent.url}</a>
      </div>
    </div>
  `;
  
  msgElement.innerHTML = html;
  
  // Show and create chart
  if (chartContainer) {
    chartContainer.style.display = 'block';
    
    // Check if Chart.js is available before creating chart
    if (typeof Chart !== 'undefined') {
      createBiasChart(percentages.left, percentages.right);
    } else {
      // Fallback: show visual representation without Chart.js
      showFallbackChart(percentages.left, percentages.right);
    }
  }
}

// Fallback chart display when Chart.js is not available
function showFallbackChart(leftPercent, rightPercent) {
  const chartContainer = document.getElementById('chartContainer');
  if (!chartContainer) return;
  
  const total = leftPercent + rightPercent;
  const leftWidth = total > 0 ? (leftPercent / total) * 100 : 50;
  const rightWidth = total > 0 ? (rightPercent / total) * 100 : 50;
  
  chartContainer.innerHTML = `
    <div style="text-align: center; margin: 10px 0;">
      <h4 style="margin: 0 0 15px 0; color: #333;">Political Bias Visualization</h4>
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
        <div style="width: 200px; height: 20px; border: 2px solid #333; border-radius: 10px; overflow: hidden; display: flex;">
          <div style="width: ${leftWidth}%; height: 100%; background: #3498db; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">
            ${leftPercent}%
          </div>
          <div style="width: ${rightWidth}%; height: 100%; background: #e74c3c; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">
            ${rightPercent}%
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: space-around; font-size: 12px;">
        <div style="color: #3498db; font-weight: bold;">🔵 Left: ${leftPercent}%</div>
        <div style="color: #e74c3c; font-weight: bold;">🔴 Right: ${rightPercent}%</div>
      </div>
    </div>
  `;
}

function updateUI() {
  const apiKeyInput = document.getElementById('apiKey');
  const apiUrlInput = document.getElementById('apiUrl');
  const saveBtn = document.getElementById('saveApiKey');
  const clearBtn = document.getElementById('clearApiKey');
  
  // Update API URL field
  if (apiUrlInput) {
    apiUrlInput.value = apiUrl;
    apiUrlInput.style.borderColor = '#4CAF50';
  }
  
  if (isKeyValid) {
    if (apiKey) {
      apiKeyInput.value = maskApiKey(apiKey);
    }
    apiKeyInput.style.borderColor = '#4CAF50';
    apiKeyInput.disabled = true;
    if (apiUrlInput) apiUrlInput.disabled = true;
    saveBtn.textContent = 'Saved ✓';
    saveBtn.style.background = '#4CAF50';
    if (clearBtn) clearBtn.style.display = 'inline-block';
  } else {
    if (apiKey) {
      apiKeyInput.value = maskApiKey(apiKey);
      apiKeyInput.style.borderColor = '#f44336';
    }
    apiKeyInput.disabled = false;
    if (apiUrlInput) apiUrlInput.disabled = false;
    saveBtn.textContent = 'Save Config';
    saveBtn.style.background = '#4CAF50';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

document.getElementById('saveApiKey').addEventListener('click', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const apiUrlInput = document.getElementById('apiUrl');
  const key = apiKeyInput.value.trim();
  const url = apiUrlInput.value.trim();
  
  // Update the global apiUrl if provided
  if (url) {
    apiUrl = url;
  }
  
  if (validateApiKey(key || url)) {
    // Test the API configuration before saving
    document.getElementById('msg').innerHTML = '<div style="color: blue;">Testing LLAMA API connection...</div>';
    
    try {
      console.log('Testing LLAMA API connection...');
      console.log('Testing URL:', `${apiUrl}/api/tags`);
      
      const testResponse = await fetch(`${apiUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('API test response status:', testResponse.status);
      console.log('API test response headers:', Object.fromEntries(testResponse.headers.entries()));
      
      if (testResponse.ok) {
        console.log('LLAMA API test successful!');
        // Save API key with proper error handling
        try {
          if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ llama_api_key: key, llama_api_url: apiUrl }, () => {
              if (chrome.runtime.lastError) {
                console.error('Error saving API key:', chrome.runtime.lastError);
                document.getElementById('msg').innerHTML = `
                  <div style="color: red;">
                    <strong>Save Error:</strong><br>
                    ${chrome.runtime.lastError.message}
                  </div>
                `;
              } else {
                console.log('API configuration saved successfully');
                apiKey = key;
                isKeyValid = true;
                updateUI();
                document.getElementById('msg').innerHTML = `
                  <div style="color: green;">
                    <strong>✓ LLAMA API Connected & Saved!</strong><br>
                    <small>Successfully connected to LLAMA server at ${apiUrl}</small>
                  </div>
                `;
              }
            });
          } else {
            console.error('Chrome storage API not available, using fallback');
            // Fallback: store in memory only
            apiKey = key;
            isKeyValid = true;
            updateUI();
            document.getElementById('msg').innerHTML = `
              <div style="color: orange;">
                <strong>⚠ LLAMA API Connected (Memory Only)</strong><br>
                <small>Connection will be lost when extension closes</small>
              </div>
            `;
          }
        } catch (error) {
          console.error('Error in storage operation:', error);
          document.getElementById('msg').innerHTML = `
            <div style="color: red;">
              <strong>Storage Error:</strong><br>
              ${error.message}
            </div>
          `;
        }
      } else {
        console.log('API key test failed with status:', testResponse.status);
        const errorData = await testResponse.text();
        console.log('API error response:', errorData);
        
        let errorMessage = `<strong>LLAMA API Connection Failed:</strong><br>Status: ${testResponse.status}<br>`;
        
        if (testResponse.status === 403) {
          errorMessage += `
            <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 3px; font-size: 11px;">
              <strong>403 Forbidden - Common Solutions:</strong><br>
              • Make sure Ollama is running: <code>ollama serve</code><br>
              • Check if server is accessible: <code>curl ${apiUrl}/api/tags</code><br>
              • Try a different port: <code>ollama serve --port 11435</code><br>
              • Restart Ollama service
            </div>
          `;
        } else if (testResponse.status === 404) {
          errorMessage += `
            <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 3px; font-size: 11px;">
              <strong>404 Not Found - Possible Issues:</strong><br>
              • Wrong API endpoint - try checking if server supports /api/tags<br>
              • Server might be using different API version<br>
              • Check server documentation for correct endpoints
            </div>
          `;
        } else {
          errorMessage += `<small>Please check that your LLAMA server is running at ${apiUrl}</small>`;
        }
        
        document.getElementById('msg').innerHTML = `
          <div style="color: red;">
            ${errorMessage}
          </div>
        `;
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      console.log('API key test error details:', error);
      document.getElementById('msg').innerHTML = `
        <div style="color: red;">
          <strong>LLAMA API Connection Error:</strong><br>
          ${error.message}<br>
          <small>Please check that your LLAMA server is running at ${apiUrl}</small>
        </div>
      `;
    }
  } else {
    console.log('Invalid API key format provided');
    apiKeyInput.style.borderColor = '#f44336';
    document.getElementById('msg').innerHTML = `
      <div style="color: red;">
        <strong>Invalid Configuration:</strong><br>
        Please enter a valid API key or LLAMA server URL (e.g., http://localhost:11434).
      </div>
    `;
  }
});

// Add clear API key functionality
document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('clearApiKey');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your API key? This will remove it from storage.')) {
        try {
          if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['llama_api_key', 'llama_api_url'], () => {
              if (chrome.runtime.lastError) {
                console.error('Error clearing API key:', chrome.runtime.lastError);
                document.getElementById('msg').innerHTML = `
                  <div style="color: red;">
                    <strong>Clear Error:</strong><br>
                    ${chrome.runtime.lastError.message}
                  </div>
                `;
              } else {
                console.log('API key cleared successfully');
                apiKey = null;
                isKeyValid = false;
                updateUI();
                document.getElementById('msg').innerHTML = '<div style="color: orange;">API key cleared from storage.</div>';
              }
            });
          } else {
            console.log('Chrome storage not available, clearing from memory');
            apiKey = null;
            isKeyValid = false;
            updateUI();
            document.getElementById('msg').innerHTML = '<div style="color: orange;">API key cleared from memory.</div>';
          }
        } catch (error) {
          console.error('Error clearing API key:', error);
          document.getElementById('msg').innerHTML = `
            <div style="color: red;">
              <strong>Clear Error:</strong><br>
              ${error.message}
            </div>
          `;
        }
      }
    });
  }
});
