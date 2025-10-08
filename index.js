const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Simple template engine
function renderTemplate(templateName, data = {}) {
    const layoutPath = path.join(__dirname, 'views', 'layout.html');
    const templatePath = path.join(__dirname, 'views', `${templateName}.html`);
    
    let layout = fs.readFileSync(layoutPath, 'utf8');
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders
    layout = layout.replace('{{title}}', data.title || 'VPN Server');
    layout = layout.replace('{{content}}', template);
    
    return layout;
}

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
    res.send(renderTemplate('create-client', { title: 'Create Client' }));
});

// Serve the users list page
app.get('/users', (req, res) => {
    res.send(renderTemplate('users-list', { title: 'Users Management' }));
});

// Old route (keeping for reference)
app.get('/old', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VPN Client Generator</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: '#667eea',
                            secondary: '#764ba2'
                        }
                    }
                }
            }
        </script>
    </head>
    <body class="bg-gradient-to-br from-primary to-secondary min-h-screen">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center py-4">
                    <div class="flex items-center space-x-4">
                        <h1 class="text-2xl font-bold text-gray-800">🔐 VPN Server</h1>
                    </div>
                    <div class="flex space-x-4">
                        <a href="/" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition">Create Client</a>
                        <a href="/users" class="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition">View Users</a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="flex items-center justify-center min-h-screen py-12 px-4">
            <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <div class="text-center mb-8">
                    <h2 class="text-3xl font-bold text-gray-800 mb-2">Create VPN Client</h2>
                    <p class="text-gray-600">Generate your WireGuard configuration</p>
                </div>
                
                <form id="vpnForm" class="space-y-6">
                    <div>
                        <label for="name" class="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                        <input type="text" id="name" name="name" required 
                               class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                               placeholder="Enter your full name">
                    </div>
                    
                    <div>
                        <label for="mobile" class="block text-sm font-semibold text-gray-700 mb-2">Mobile Number</label>
                        <input type="text" id="mobile" name="mobile" required maxlength="11"
                               class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                               placeholder="Enter 11-digit mobile number">
                        <div id="mobileError" class="text-red-500 text-sm mt-2 hidden"></div>
                    </div>
                    
                    <button type="submit" id="submitBtn" 
                            class="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-1 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                        Generate VPN Client
                    </button>
                </form>
                
                <div id="result" class="mt-6 hidden"></div>
            </div>
        </div>
        
        <script>
            // Real-time mobile validation
            document.getElementById('mobile').addEventListener('input', function(e) {
                const mobile = e.target.value.replace(/\D/g, ''); // Remove non-digits
                e.target.value = mobile; // Update input with only digits
                
                const errorDiv = document.getElementById('mobileError');
                
                if (mobile.length === 0) {
                    errorDiv.style.display = 'none';
                } else if (mobile.length < 11) {
                    errorDiv.textContent = \`Need \${11 - mobile.length} more digits\`;
                    errorDiv.style.display = 'block';
                } else if (mobile.length > 11) {
                    errorDiv.textContent = 'Too many digits (max 11)';
                    errorDiv.style.display = 'block';
                } else if (!mobile.startsWith('01')) {
                    errorDiv.textContent = 'Mobile number must start with 01';
                    errorDiv.style.display = 'block';
                } else {
                    errorDiv.style.display = 'none';
                }
            });
            
            document.getElementById('vpnForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const name = document.getElementById('name').value.trim();
                const mobile = document.getElementById('mobile').value.trim().replace(/\D/g, '');

                const submitBtn = document.getElementById('submitBtn');
                const result = document.getElementById('result');
                
                if (!name || !mobile) {
                    showResult('Please fill in all fields', 'error');
                    return;
                }
                
                // Simple validation: 11 digits starting with 01
                if (mobile.length !== 11 || !mobile.startsWith('01')) {
                    showResult('Mobile number must be 11 digits starting with 01', 'error');
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

    // Simple validation: 11 digits starting with 01
    if (mobile.length !== 11 || !mobile.startsWith('01')) {
        return res.status(400).json({ error: 'Mobile number must be 11 digits starting with 01' });
    }

    try {
        // Check if client with same name already exists
        const existingName = await VPNClient.findOne({ name });
        if (existingName) {
            return res.status(400).json({
                error: 'A client with this name already exists'
            });
        }
        
        // Check if client with same mobile already exists
        const existingMobile = await VPNClient.findOne({ mobile });
        if (existingMobile) {
            return res.status(400).json({
                error: 'A client with this mobile number already exists'
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

// Delete client endpoint
app.delete('/delete-client/:id', async (req, res) => {
    try {
        const clientId = req.params.id;
        
        // Find the client first
        const client = await VPNClient.findById(clientId);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        
        console.log(`Deleting VPN client: ${client.name} (${client.mobile})`);
        
        // Remove client from WireGuard server using your script
        const scriptPath = "/home/altaf/wireguard-scripts/remove-wg-client.sh";
        const cmd = `bash ${scriptPath} "${client.name}"`;
        
        exec(cmd, async (error, stdout, stderr) => {
            if (error) {
                console.error('Script execution error:', error);
                console.error('Script stderr:', stderr);
                console.error('Script stdout:', stdout);
                return res.status(500).json({ 
                    error: `Failed to remove client from server: ${stderr || error.message}` 
                });
            }
            
            // Log script output for debugging
            if (stdout) console.log('Remove script stdout:', stdout);
            if (stderr) console.log('Remove script stderr:', stderr);
            
            try {
                // Delete client files if they exist
                if (client.confFile && fs.existsSync(client.confFile)) {
                    fs.unlinkSync(client.confFile);
                    console.log(`Deleted config file: ${client.confFile}`);
                }
                
                if (client.qrFile && fs.existsSync(client.qrFile)) {
                    fs.unlinkSync(client.qrFile);
                    console.log(`Deleted QR file: ${client.qrFile}`);
                }
                
                // Remove from database
                await VPNClient.findByIdAndDelete(clientId);
                
                console.log(`Successfully deleted VPN client: ${client.name}`);
                
                res.json({
                    message: 'VPN client deleted successfully',
                    name: client.name,
                    mobile: client.mobile
                });
            } catch (dbError) {
                console.error('Database error:', dbError);
                res.status(500).json({ error: 'Failed to delete client from database' });
            }
        });
    } catch (err) {
        console.error('General error:', err);
        res.status(500).json({ error: err.message });
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
