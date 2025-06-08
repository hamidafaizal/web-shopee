// PWA with Polling - No FCM Required
class KomisiApp {
    constructor() {
        this.batches = [];
        this.totalLinks = 0;
        this.seenBatchIds = new Set(); // Track batches sudah diterima
        this.init();
    }

    init() {
        this.loadLocalBatches();
        this.bindEvents();
        this.renderBatches();
        this.updateUI();
        this.startPolling(); // Start polling untuk real-time
    }

    bindEvents() {
        const backBtn = document.getElementById('backBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const copyAllBtn = document.getElementById('copyAllBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        
        backBtn.addEventListener('click', () => this.goBack());
        settingsBtn.addEventListener('click', () => this.showInfo());
        copyAllBtn.addEventListener('click', () => this.copyAllLinks());
        clearAllBtn.addEventListener('click', () => this.clearAllChat());
    }

    // Polling untuk real-time updates
    startPolling() {
        console.log('🔄 Starting polling for new batches...');
        
        // Polling setiap 3 detik
        setInterval(() => {
            this.checkNewBatches();
        }, 3000);
        
        // Initial check
        this.checkNewBatches();
    }

    async checkNewBatches() {
        try {
            console.log('🔍 Checking for new batches...');
            
            const response = await fetch('/api/latest-batches');
            const result = await response.json();
            
            console.log('📡 API Response:', result);
            
            if (result.success && result.batches.length > 0) {
                console.log(`📦 Found ${result.batches.length} batches from server`);
                
                let newBatchCount = 0;
                
                result.batches.forEach(batch => {
                    console.log(`🔍 Checking batch ID: ${batch.id}, seen: ${this.seenBatchIds.has(batch.id)}`);
                    
                    if (!this.seenBatchIds.has(batch.id)) {
                        this.seenBatchIds.add(batch.id);
                        
                        const formattedBatch = {
                            id: batch.id,
                            hpLabel: batch.hp_label || 'HP',
                            count: batch.links.length,
                            links: batch.links,
                            timestamp: batch.created_at || new Date().toISOString()
                        };
                        
                        console.log('✅ Adding new batch:', formattedBatch);
                        this.addBatch(formattedBatch);
                        newBatchCount++;
                    }
                });
                
                if (newBatchCount > 0) {
                    console.log(`📱 Added ${newBatchCount} new batch(es)`);
                    this.showAlert(`${newBatchCount} batch baru diterima!`, 'success');
                }
            } else {
                console.log('📭 No new batches found');
            }
        } catch (error) {
            console.error('❌ Polling error:', error);
        }
    }

    addBatch(batch) {
        this.batches.unshift(batch); // Add to beginning (newest first)
        this.saveBatches();
        this.renderBatches();
        this.updateUI();
        
        // Auto scroll to new message
        const container = document.getElementById('messagesContainer');
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }

    renderBatches() {
        const container = document.getElementById('messagesContainer');
        const systemMessage = container.querySelector('.system-message');
        
        // Clear existing batch messages
        const existingBatches = container.querySelectorAll('.batch-message');
        existingBatches.forEach(batch => batch.remove());
        
        if (this.batches.length === 0) {
            systemMessage.style.display = 'block';
            systemMessage.innerHTML = `
                <p>🎯 PWA Siap Menerima Link Komisi</p>
                <small>Polling aktif - menunggu batch dari admin...</small>
            `;
            return;
        }
        
        systemMessage.style.display = 'none';
        
        this.batches.forEach((batch, index) => {
            const batchElement = this.createBatchElement(batch, index);
            container.appendChild(batchElement);
        });
    }

    createBatchElement(batch, index) {
        const div = document.createElement('div');
        div.className = 'batch-message';
        div.dataset.batchIndex = index;
        
        const time = new Date(batch.timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Create links display (tanpa nomor, hanya tumpuk)
        const linksDisplay = batch.links.map(link => `<div class="link-item">${link}</div>`).join('');
        
        div.innerHTML = `
            <div class="batch-header">
                <div class="batch-from">${batch.hpLabel}</div>
                <div class="batch-time">${time}</div>
            </div>
            <div class="batch-count">${batch.count} links</div>
            <div class="links-container">
                ${linksDisplay}
            </div>
            <div class="batch-actions">
                <button class="batch-btn" onclick="app.copyBatchLinks(${index})">
                    📋 Copy
                </button>
                <button class="batch-btn" onclick="app.deleteBatch(${index})">
                    🗑️ Hapus
                </button>
            </div>
        `;
        
        return div;
    }

    copyBatchLinks(batchIndex) {
        const batch = this.batches[batchIndex];
        if (!batch) return;
        
        const links = batch.links.join('\n');
        this.copyToClipboard(links, `${batch.count} links dari ${batch.hpLabel} disalin!`);
    }

    deleteBatch(batchIndex) {
        if (!confirm('Hapus batch ini?')) return;
        
        const batch = this.batches[batchIndex];
        this.batches.splice(batchIndex, 1);
        this.seenBatchIds.delete(batch.id); // Remove from seen list
        this.saveBatches();
        this.renderBatches();
        this.updateUI();
        
        this.showAlert(`Batch ${batch.hpLabel} berhasil dihapus`, 'success');
    }

    copyAllLinks() {
        if (this.batches.length === 0) {
            this.showAlert('Tidak ada link untuk disalin', 'error');
            return;
        }
        
        const allLinks = this.batches.flatMap(batch => batch.links);
        const linksText = allLinks.join('\n');
        
        this.copyToClipboard(linksText, `Semua ${allLinks.length} links disalin!`);
    }

    clearAllChat() {
        if (this.batches.length === 0) {
            this.showAlert('Chat sudah kosong', 'error');
            return;
        }
        
        if (!confirm(`Hapus semua ${this.batches.length} batch chat?`)) {
            return;
        }
        
        this.batches = [];
        this.seenBatchIds.clear();
        this.saveBatches();
        this.renderBatches();
        this.updateUI();
        
        this.showAlert('Semua chat berhasil dihapus', 'success');
    }

    updateUI() {
        this.totalLinks = this.batches.reduce((sum, batch) => sum + batch.count, 0);
        
        const totalLinksCount = document.getElementById('totalLinksCount');
        const copyAllBtn = document.getElementById('copyAllBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        
        totalLinksCount.textContent = `${this.totalLinks} links tersedia`;
        
        copyAllBtn.disabled = this.totalLinks === 0;
        clearAllBtn.disabled = this.batches.length === 0;
    }

    async copyToClipboard(text, successMessage) {
        try {
            await navigator.clipboard.writeText(text);
            this.showAlert(successMessage, 'success');
        } catch (error) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            this.showAlert(successMessage, 'success');
        }
    }

    saveBatches() {
        localStorage.setItem('komisi_batches', JSON.stringify(this.batches));
        localStorage.setItem('seen_batch_ids', JSON.stringify([...this.seenBatchIds]));
    }

    loadLocalBatches() {
        // Load batches
        const saved = localStorage.getItem('komisi_batches');
        if (saved) {
            try {
                this.batches = JSON.parse(saved);
            } catch (error) {
                console.error('Error loading saved batches:', error);
                this.batches = [];
            }
        }
        
        // Load seen batch IDs
        const seenIds = localStorage.getItem('seen_batch_ids');
        if (seenIds) {
            try {
                const ids = JSON.parse(seenIds);
                this.seenBatchIds = new Set(ids);
            } catch (error) {
                console.error('Error loading seen IDs:', error);
                this.seenBatchIds = new Set();
            }
        }
    }

    goBack() {
        if (document.referrer) {
            window.history.back();
        } else {
            this.showAlert('Tekan tombol Home untuk keluar aplikasi', 'info');
        }
    }

    showInfo() {
        const info = `
🎯 Komisi Mobile PWA
📱 Install aplikasi ini di home screen
🔄 Auto-refresh setiap 3 detik
📋 Copy link untuk proses komisi

Status: Polling aktif
Total Batch: ${this.batches.length}
Total Links: ${this.totalLinks}
        `;
        
        alert(info);
    }

    // Test method untuk manual add batch
    testAddBatch() {
        const testBatch = {
            id: Date.now(),
            hpLabel: 'HP Test',
            count: 3,
            links: [
                'https://shopee.co.id/product/123456789',
                'https://shopee.co.id/product/987654321', 
                'https://shopee.co.id/product/555666777'
            ],
            timestamp: new Date().toISOString()
        };
        
        this.addBatch(testBatch);
        this.showAlert('Test batch berhasil ditambahkan!', 'success');
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlert = document.querySelector('.pwa-alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        const alert = document.createElement('div');
        alert.className = `pwa-alert alert-${type}`;
        
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        
        alert.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span>${icon}</span>
                <span>${message}</span>
            </div>
        `;
        
        const bgColor = type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3';
        
        alert.style.cssText = `
            position: fixed;
            top: 1rem;
            left: 1rem;
            right: 1rem;
            padding: 1rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            background: ${bgColor};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInDown 0.3s ease-out;
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.style.animation = 'slideOutUp 0.3s ease-in';
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInDown {
        from {
            transform: translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutUp {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(-100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new KomisiApp();
    console.log('🚀 Komisi PWA with Polling initialized');
});