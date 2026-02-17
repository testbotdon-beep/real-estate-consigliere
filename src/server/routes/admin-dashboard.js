// Simple Admin Dashboard UI
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consigliere | Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0d0d0f; color: #f5f5f7; min-height: 100vh; }
    
    .header { background: #151517; border-bottom: 1px solid #2a2a2e; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .header .badge { background: #2997ff; padding: 4px 10px; border-radius: 12px; font-size: 12px; }
    
    .nav { display: flex; gap: 4px; padding: 12px 24px; background: #151517; border-bottom: 1px solid #2a2a2e; }
    .nav button { background: transparent; border: none; color: #86868b; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
    .nav button:hover { background: #1f1f23; color: #fff; }
    .nav button.active { background: #2997ff; color: white; }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #151517; border: 1px solid #2a2a2e; border-radius: 16px; padding: 24px; }
    .stat-card .label { font-size: 13px; color: #86868b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-card .value { font-size: 36px; font-weight: 700; }
    .stat-card .value.hot { color: #ff453a; }
    .stat-card .value.warm { color: #ff9f0a; }
    .stat-card .value.cold { color: #30d158; }
    
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    
    .card { background: #151517; border: 1px solid #2a2a2e; border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .card .info h4 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .card .info p { font-size: 13px; color: #86868b; }
    .card .meta { text-align: right; }
    .card .meta .status { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .card .meta .status.pending { background: rgba(255, 159, 10, 0.2); color: #ff9f0a; }
    .card .meta .status.confirmed { background: rgba(48, 209, 88, 0.2); color: #30d158; }
    .card .meta .status.new { background: rgba(41, 151, 255, 0.2); color: #2997ff; }
    .card .meta .status.qualified { background: rgba(48, 209, 88, 0.2); color: #30d158; }
    .card .meta .time { font-size: 12px; color: #666; margin-top: 4px; }
    
    .priority-badge { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
    .priority-badge.hot { background: #ff453a; }
    .priority-badge.warm { background: #ff9f0a; }
    .priority-badge.cold { background: #30d158; }
    
    .empty { text-align: center; padding: 40px; color: #666; }
    
    .source-tag { display: inline-block; background: #2997ff; color: white; padding: 2px 8px; border-radius: 8px; font-size: 11px; margin-left: 8px; }
    .source-tag.telegram { background: #0088cc; }
    .source-tag.whatsapp { background: #25D366; }
    
    @media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🦅 Consigliere <span class="badge">Dashboard</span></h1>
    <button onclick="location.reload()" style="background: #2d2d2f; border: 1px solid #444; color: #fff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px;">↻ Refresh</button>
  </div>
  
  <div class="nav">
    <button class="active" onclick="showTab('overview')">Overview</button>
    <button onclick="showTab('leads')">Leads</button>
    <button onclick="showTab('appointments')">Appointments</button>
    <button onclick="showTab('properties')">Properties</button>
  </div>
  
  <div class="container" id="content">
    Loading...
  </div>
  
  <script>
    async function loadData() {
      try {
        const [statsRes, leadsRes, appointmentsRes, propertiesRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/leads'),
          fetch('/api/appointments'),
          fetch('/api/properties')
        ]);
        
        const stats = await statsRes.json();
        const leadsData = await leadsRes.json();
        const appointmentsData = await appointmentsRes.json();
        const propertiesData = await propertiesRes.json();
        
        window.data = { 
          stats, 
          leads: leadsData.leads || [], 
          appointments: appointmentsData.appointments || [],
          properties: propertiesData.properties || []
        };
        
        console.log('Loaded:', window.data);
        showTab('overview');
      } catch (e) {
        console.error('Error loading data:', e);
        document.getElementById('content').innerHTML = '<div class="empty">Error loading data: ' + e.message + '</div>';
      }
    }
    
    function showTab(tab) {
      if (event && event.target) {
        document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
      }
      
      const content = document.getElementById('content');
      const d = window.data;
      
      if (!d || !d.stats) {
        content.innerHTML = '<div class="empty">Loading...</div>';
        return;
      }
      
      if (tab === 'overview') {
        const hotLeads = d.leads.filter(l => l.priority === 'hot').length;
        content.innerHTML = \`
          <div class="stats-grid">
            <div class="stat-card">
              <div class="label">Total Leads</div>
              <div class="value">\${d.leads.length}</div>
            </div>
            <div class="stat-card">
              <div class="label">Hot Leads</div>
              <div class="value hot">\${hotLeads}</div>
            </div>
            <div class="stat-card">
              <div class="label">Appointments</div>
              <div class="value">\${d.appointments.length}</div>
            </div>
            <div class="stat-card">
              <div class="label">Properties</div>
              <div class="value">\${d.properties.length}</div>
            </div>
          </div>
          
          <div class="section">
            <h2>Recent Leads</h2>
            \${d.leads.slice(0, 5).map(lead => \`
              <div class="card">
                <div class="info">
                  <h4><span class="priority-badge \${lead.priority || 'cold'}"></span>\${lead.name || lead.phone}</h4>
                  <p>\${lead.phone || 'No phone'} <span class="source-tag \${lead.source}">\${lead.source}</span></p>
                </div>
                <div class="meta">
                  <span class="status \${lead.status}">\${lead.status}</span>
                </div>
              </div>
            \`).join('') || '<div class="empty">No leads yet</div>'}
          </div>
          
          <div class="section">
            <h2>Recent Appointments</h2>
            \${d.appointments.slice(0, 5).map(apt => \`
              <div class="card">
                <div class="info">
                  <h4>\${apt.clientName}</h4>
                  <p>\${apt.propertyAddress}</p>
                </div>
                <div class="meta">
                  <span class="status \${apt.status}">\${apt.status}</span>
                  <div class="time">\${new Date(apt.startTime).toLocaleString()}</div>
                </div>
              </div>
            \`).join('') || '<div class="empty">No appointments</div>'}
          </div>
        \`;
      } else if (tab === 'leads') {
        content.innerHTML = \`
          <div class="section">
            <h2>All Leads (\${d.leads.length})</h2>
            \${d.leads.map(lead => \`
              <div class="card">
                <div class="info">
                  <h4><span class="priority-badge \${lead.priority || 'cold'}"></span>\${lead.name || 'Unknown'}</h4>
                  <p>\${lead.phone || 'No phone'} | Score: \${lead.score || 'N/A'}</p>
                </div>
                <div class="meta">
                  <span class="source-tag \${lead.source}">\${lead.source}</span>
                  <span class="status \${lead.status}" style="margin-left:8px">\${lead.status}</span>
                  <div class="time">\${new Date(lead.createdAt).toLocaleString()}</div>
                </div>
              </div>
            \`).join('') || '<div class="empty">No leads</div>'}
          </div>
        \`;
      } else if (tab === 'appointments') {
        content.innerHTML = \`
          <div class="section">
            <h2>All Appointments (\${d.appointments.length})</h2>
            \${d.appointments.map(apt => \`
              <div class="card">
                <div class="info">
                  <h4>\${apt.clientName}</h4>
                  <p>\${apt.clientPhone} | \${apt.propertyAddress}</p>
                </div>
                <div class="meta">
                  <span class="status \${apt.status}">\${apt.status}</span>
                  <div class="time">\${new Date(apt.startTime).toLocaleString()}</div>
                </div>
              </div>
            \`).join('') || '<div class="empty">No appointments</div>'}
          </div>
        \`;
      } else if (tab === 'properties') {
        content.innerHTML = \`
          <div class="section">
            <h2>All Properties (\${d.properties.length})</h2>
            \${d.properties.map(prop => \`
              <div class="card">
                <div class="info">
                  <h4>\${prop.name}</h4>
                  <p>\${prop.address}</p>
                </div>
                <div class="meta">
                  <span class="status confirmed">\${prop.price}</span>
                  <div class="time">\${prop.size}</div>
                </div>
              </div>
            \`).join('') || '<div class="empty">No properties</div>'}
          </div>
        \`;
      }
    }
    
    loadData();
  </script>
</body>
</html>
  `);
});

module.exports = router;
