const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 7000;

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/vpn_clients', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('MongoDB connected'));

// VPN Client Schema
const vpnClientSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  mobile: { type: String, unique: true },
  vpnServer: { type: String, default: 'wg0' },
  confFile: String,
  qrFile: String,
  createdAt: { type: Date, default: Date.now },
});
const VPNClient = mongoose.model('VPNClient', vpnClientSchema);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from wireguard-clients
const CLIENT_DIR = path.join(process.env.HOME, 'wireguard-clients');
if (!fs.existsSync(CLIENT_DIR)) fs.mkdirSync(CLIENT_DIR, { recursive: true });
app.use('/clients', express.static(CLIENT_DIR));

// Serve the main form page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VPN Client Generator</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .container {
                background: white;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                width: 100%;
                max-width: 500px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .header h1 {
                color: #333;
                font-size: 2.5em;
                margin-bottom: 10px;
            }
            
            .header p {
                color: #666;
                font-size: 1.1em;
            }
            
            .form-group {
                margin-bottom: 25px;
            }
            
            label {
                display: block;
                margin-bottom: 8px;
                color: #333;
                font-weight: 600;
                font-size: 1.1em;
            }
            
            input[type="text"] {
                width: 100%;
                padding: 15px;
                border: 2px solid #e1e5e9;
                border-radius: 10px;
                font-size: 1.1em;
                transition: border-color 0.3s ease;
            }
            
            input[type="text"]:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .btn {
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 1.2em;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            .btn:active {
                transform: translateY(0);
            }
            
            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .result {
                margin-top: 20px;
                padding: 20px;
                border-radius: 10px;
                display: none;
            }
            
            .success {
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
            }
            
            .error {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
            }
            
            .loading {
                text-align: center;
                color: #666;
            }
            
            .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #667eea;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 0 auto 10px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .qr-code {
                text-align: center;
                margin-top: 20px;
            }
            
            .qr-code img {
                max-width: 200px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            
            .download-links {
                margin-top: 20px;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .download-btn {
                flex: 1;
                padding: 10px;
                background: #28a745;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                text-align: center;
                font-weight: 600;
                transition: background 0.3s ease;
            }
            
            .download-btn:hover {
                background: #218838;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 VPN Client Generator</h1>
                <p>Create your WireGuard VPN client configuration</p>
            </div>
            
            <form id="vpnForm">
                <div class="form-group">
                    <label for="name">Full Name:</label>
                    <input type="text" id="name" name="name" required placeholder="Enter your full name">
                </div>
                
                <div class="form-group">
                    <label for="mobile">Mobile Number:</label>
                    <input type="text" id="mobile" name="mobile" required pattern="\d{11}" placeholder="Enter 11-digit mobile number (e.g., 01712345678)" maxlength="11">
                </div>
                
                <button type="submit" class="btn" id="submitBtn">Generate VPN Client</button>
            </form>
            
            <div id="result" class="result"></div>
        </div>
        
        <script>
            document.getElementById('vpnForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const name = document.getElementById('name').value.trim();
                const mobile = document.getElementById('mobile').value.trim();
                const submitBtn = document.getElementById('submitBtn');
                const result = document.getElementById('result');
                
                if (!name || !mobile) {
                    showResult('Please fill in all fields', 'error');
                    return;
                }
                
                // Validate mobile number format
                if (!/^\d{11}$/.test(mobile)) {
                    showResult('Mobile number must be exactly 11 digits', 'error');
                    return;
                }
                
                // Show loading state
                submitBtn.disabled = true;
                submitBtn.textContent = 'Generating...';
                result.className = 'result loading';
                result.innerHTML = '<div class="spinner"></div>Creating your VPN client configuration...';
                result.style.display = 'block';
                
                try {
                    const response = await fetch('/create-client', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ name, mobile })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showSuccess(data);
                    } else {
                        showResult(data.error || 'An error occurred', 'error');
                    }
                } catch (error) {
                    showResult('Network error: ' + error.message, 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Generate VPN Client';
                }
            });
            
            function showResult(message, type) {
                const result = document.getElementById('result');
                result.className = 'result ' + type;
                result.innerHTML = message;
                result.style.display = 'block';
            }
            
            function showSuccess(data) {
                const result = document.getElementById('result');
                result.className = 'result success';
                
                const qrSection = data.qrFile ? \`
                    <div class="qr-code">
                        <h4>QR Code:</h4>
                        <img src="\${data.qrFile}" alt="VPN QR Code" onerror="this.style.display='none'">
                    </div>
                \` : '<p><em>QR code was not generated by the script</em></p>';
                
                const downloadLinks = \`
                    <div class="download-links">
                        <a href="\${data.downloadLinks.config}" class="download-btn" download>Download Config File</a>
                        \${data.downloadLinks.qr ? \`<a href="\${data.downloadLinks.qr}" class="download-btn" download>Download QR Code</a>\` : ''}
                    </div>
                \`;
                
                result.innerHTML = \`
                    <h3>✅ VPN Client Created Successfully!</h3>
                    <p><strong>Name:</strong> \${data.name}</p>
                    <p><strong>Mobile:</strong> \${data.mobile}</p>
                    \${qrSection}
                    \${downloadLinks}
                \`;
                result.style.display = 'block';
            }
        </script>
    </body>
    </html>
  `);
});

// Route to create VPN client
app.post('/create-client', async (req, res) => {
  const { name, mobile } = req.body;

  if (!name || !mobile)
    return res.status(400).json({ error: 'Name and mobile required' });

  // Validate mobile number format (11 digits)
  if (!/^\d{11}$/.test(mobile)) {
    return res.status(400).json({ error: 'Mobile number must be exactly 11 digits' });
  }

  try {
    // Check if client already exists
    const existingClient = await VPNClient.findOne({
      $or: [{ name }, { mobile }]
    });
    
    if (existingClient) {
      return res.status(400).json({ 
        error: existingClient.name === name ? 
          'A client with this name already exists' : 
          'A client with this mobile number already exists' 
      });
    }

    // Create safe filenames (replace spaces and special chars)
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeMobile = mobile.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    const confPath = path.join(CLIENT_DIR, `${safeName}.conf`);
    const qrPath = path.join(CLIENT_DIR, `${safeMobile}.png`);

    console.log(`Creating VPN client for ${name} (${mobile})`);
    console.log(`Config file: ${confPath}`);
    console.log(`QR file: ${qrPath}`);

    // Use your existing server script - adjust the path as needed
    // Assuming your script is in /usr/local/bin/ or similar server path
    const cmd = `/home/altaf/wireguard-scripts/create-wg-client.sh "${name}" "${mobile}" "${qrPath}"`;
    
    exec(cmd, { timeout: 30000 }, async (error, stdout, stderr) => {
      if (error) {
        console.error('Script execution error:', error);
        console.error('Script stderr:', stderr);
        console.error('Script stdout:', stdout);
        return res.status(500).json({ 
          error: `Script execution failed: ${stderr || error.message}` 
        });
      }

      // Log script output for debugging
      if (stdout) console.log('Script stdout:', stdout);
      if (stderr) console.log('Script stderr:', stderr);

      // Verify files were created
      if (!fs.existsSync(confPath)) {
        console.error(`Config file not created: ${confPath}`);
        return res.status(500).json({ error: 'Config file was not created by script' });
      }

      if (!fs.existsSync(qrPath)) {
        console.warn(`QR file not created: ${qrPath}`);
        // Continue without QR file - it's optional
      }

      try {
        // Save client info in DB
        const client = new VPNClient({
          name,
          mobile,
          vpnServer: 'wg0',
          confFile: confPath,
          qrFile: fs.existsSync(qrPath) ? qrPath : null,
        });
        await client.save();

        console.log(`Successfully created VPN client for ${name}`);

        res.json({
          message: 'VPN client created successfully',
          name,
          mobile,
          confFile: confPath,
          qrFile: fs.existsSync(qrPath) ? `/clients/${safeMobile}.png` : null,
          downloadLinks: {
            config: `/clients/${safeName}.conf`,
            qr: fs.existsSync(qrPath) ? `/clients/${safeMobile}.png` : null
          }
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        res.status(500).json({ error: 'Failed to save client to database' });
      }
    });
  } catch (err) {
    console.error('General error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route to list all clients (for admin purposes)
app.get('/clients', async (req, res) => {
  try {
    const clients = await VPNClient.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to get client by mobile number
app.get('/client/:mobile', async (req, res) => {
  try {
    const client = await VPNClient.findOne({ mobile: req.params.mobile });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: db.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 VPN Server running on http://localhost:${PORT}`);
  console.log(`📁 Client files will be stored in: ${CLIENT_DIR}`);
});
