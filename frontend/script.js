/**
 * Library RAG Bot - Frontend Application JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // State Management
    const state = {
        activeTab: 'chat',
        chatHistory: [],
        documents: [],
        hasGeminiKey: false,
        theme: localStorage.getItem('library_rag_theme') || 'dark'
    };

    // DOM Elements
    const elements = {
        // Sidebar & Topbar
        sidebar: document.getElementById('sidebar'),
        openSidebarBtn: document.getElementById('openSidebarBtn'),
        closeSidebarBtn: document.getElementById('closeSidebarBtn'),
        pageTitle: document.getElementById('pageTitle'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        navItems: document.querySelectorAll('.nav-item'),
        tabViews: document.querySelectorAll('.tab-view'),
        newChatBtn: document.getElementById('newChatBtn'),
        clearChatBtn: document.getElementById('clearChatBtn'),
        navDocBadge: document.getElementById('navDocBadge'),
        
        // Status Indicators
        vectorStatusText: document.getElementById('vectorStatusText'),
        engineStatusText: document.getElementById('engineStatusText'),

        // Chat Elements
        welcomeCard: document.getElementById('welcomeCard'),
        chatMessages: document.getElementById('chatMessages'),
        typingIndicator: document.getElementById('typingIndicator'),
        chatForm: document.getElementById('chatForm'),
        chatInput: document.getElementById('chatInput'),
        sendBtn: document.getElementById('sendBtn'),
        suggestedPills: document.getElementById('suggestedPills'),

        // Knowledge Base Dashboard Elements
        reindexBtn: document.getElementById('reindexBtn'),
        openUploadModalBtn: document.getElementById('openUploadModalBtn'),
        statTotalDocs: document.getElementById('statTotalDocs'),
        statTotalChunks: document.getElementById('statTotalChunks'),
        statStorageEngine: document.getElementById('statStorageEngine'),
        documentsTableBody: document.getElementById('documentsTableBody'),
        docTableSearch: document.getElementById('docTableSearch'),

        // Upload Modal Elements
        uploadModal: document.getElementById('uploadModal'),
        closeUploadModalBtn: document.getElementById('closeUploadModalBtn'),
        cancelUploadBtn: document.getElementById('cancelUploadBtn'),
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('fileInput'),
        selectedFileInfo: document.getElementById('selectedFileInfo'),
        selectedFileName: document.getElementById('selectedFileName'),
        removeFileBtn: document.getElementById('removeFileBtn'),
        submitUploadBtn: document.getElementById('submitUploadBtn'),

        // Chunk Inspector Modal Elements
        chunkModal: document.getElementById('chunkModal'),
        closeChunkModalBtn: document.getElementById('closeChunkModalBtn'),
        chunkModalBody: document.getElementById('chunkModalBody'),

        // Vector Search Elements
        vectorSearchForm: document.getElementById('vectorSearchForm'),
        vectorQueryInput: document.getElementById('vectorQueryInput'),
        vectorResultsContainer: document.getElementById('vectorResultsContainer'),

        // Settings Elements
        settingsForm: document.getElementById('settingsForm'),
        geminiApiKeyInput: document.getElementById('geminiApiKeyInput'),
        toggleKeyVisibility: document.getElementById('toggleKeyVisibility'),
        chunkSizeInput: document.getElementById('chunkSizeInput'),
        chunkSizeVal: document.getElementById('chunkSizeVal'),
        chunkOverlapInput: document.getElementById('chunkOverlapInput'),
        chunkOverlapVal: document.getElementById('chunkOverlapVal'),
        topKInput: document.getElementById('topKInput'),
        topKVal: document.getElementById('topKVal'),

        // Toast Container
        toastContainer: document.getElementById('toastContainer')
    };

    // Initialize Application
    init();

    function init() {
        applyTheme(state.theme);
        setupEventListeners();
        fetchSystemHealth();
        fetchDocumentsList();
        fetchSettings();
    }

    // =========================================================================
    // Theme & Navigation Handlers
    // =========================================================================

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        state.theme = theme;
        localStorage.setItem('library_rag_theme', theme);
        const icon = elements.themeToggleBtn.querySelector('i');
        if (theme === 'light') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }

    function switchTab(tabId) {
        state.activeTab = tabId;
        
        elements.navItems.forEach(item => {
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        elements.tabViews.forEach(view => {
            if (view.id === `tab-${tabId}`) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });

        const titles = {
            'chat': 'Chat Assistant',
            'knowledge': 'Knowledge Base Dashboard',
            'vector-search': 'Vector Search Explorer',
            'settings': 'Settings & RAG Configuration'
        };
        elements.pageTitle.textContent = titles[tabId] || 'Library RAG Bot';

        if (window.innerWidth <= 768) {
            elements.sidebar.classList.remove('mobile-open');
        }

        if (tabId === 'knowledge') {
            fetchDocumentsList();
        }
    }

    function setupEventListeners() {
        // Theme toggle
        elements.themeToggleBtn.addEventListener('click', () => {
            applyTheme(state.theme === 'dark' ? 'light' : 'dark');
        });

        // Header settings button
        const headerSettingsBtn = document.getElementById('headerSettingsBtn');
        if (headerSettingsBtn) {
            headerSettingsBtn.addEventListener('click', () => switchTab('settings'));
        }

        // Mobile drawer
        elements.openSidebarBtn.addEventListener('click', () => {
            elements.sidebar.classList.add('mobile-open');
        });
        elements.closeSidebarBtn.addEventListener('click', () => {
            elements.sidebar.classList.remove('mobile-open');
        });

        // Tab click
        elements.navItems.forEach(item => {
            item.addEventListener('click', () => switchTab(item.dataset.tab));
        });

        // Recent conversation history item click
        const historyList = document.getElementById('historyList');
        if (historyList) {
            historyList.addEventListener('click', (e) => {
                const item = e.target.closest('.history-item');
                if (item && item.dataset.topic) {
                    elements.chatInput.value = item.dataset.topic;
                    switchTab('chat');
                    handleChatSubmit();
                }
            });
        }

        // New & Clear Chat
        elements.newChatBtn.addEventListener('click', resetChat);
        elements.clearChatBtn.addEventListener('click', resetChat);

        // Suggested questions
        elements.suggestedPills.addEventListener('click', (e) => {
            const btn = e.target.closest('.suggested-pill');
            if (btn && btn.dataset.query) {
                elements.chatInput.value = btn.dataset.query;
                handleChatSubmit();
            }
        });

        // Auto-expand chat textarea & submit on Enter
        elements.chatInput.addEventListener('input', () => {
            elements.chatInput.style.height = 'auto';
            elements.chatInput.style.height = (elements.chatInput.scrollHeight) + 'px';
        });

        elements.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit();
            }
        });

        elements.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleChatSubmit();
        });

        // Knowledge Base Action listeners
        const refreshDocsBtn = document.getElementById('refreshDocsBtn');
        if (refreshDocsBtn) {
            refreshDocsBtn.addEventListener('click', () => {
                fetchSystemHealth();
                fetchDocumentsList();
                showToast('Refreshed document list.', 'info');
            });
        }
        
        const refreshStatusBtn = document.getElementById('refreshStatusBtn');
        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener('click', () => {
                fetchSystemHealth();
                fetchDocumentsList();
                showToast('Refreshed status.', 'info');
            });
        }

        const goToKbBtn = document.getElementById('goToKbBtn');
        if (goToKbBtn) {
            goToKbBtn.addEventListener('click', () => switchTab('knowledge'));
        }

        const quickUploadBtn = document.getElementById('quickUploadBtn');
        if (quickUploadBtn) {
            quickUploadBtn.addEventListener('click', () => openModal(elements.uploadModal));
        }

        const quickReindexBtn = document.getElementById('quickReindexBtn');
        if (quickReindexBtn) {
            quickReindexBtn.addEventListener('click', triggerReindex);
        }

        const quickClearBtn = document.getElementById('quickClearBtn');
        if (quickClearBtn) {
            quickClearBtn.addEventListener('click', resetChat);
        }

        elements.reindexBtn.addEventListener('click', triggerReindex);
        elements.openUploadModalBtn.addEventListener('click', () => openModal(elements.uploadModal));
        elements.closeUploadModalBtn.addEventListener('click', () => closeModal(elements.uploadModal));
        elements.cancelUploadBtn.addEventListener('click', () => closeModal(elements.uploadModal));
        elements.closeChunkModalBtn.addEventListener('click', () => closeModal(elements.chunkModal));

        // File Dropzone setup
        elements.dropzone.addEventListener('click', () => elements.fileInput.click());
        elements.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropzone.classList.add('dragover');
        });
        elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('dragover'));
        elements.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
        elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
        elements.removeFileBtn.addEventListener('click', clearFileSelect);
        elements.submitUploadBtn.addEventListener('click', uploadSelectedFile);

        // Filter Table
        elements.docTableSearch.addEventListener('input', filterDocumentsTable);

        // Vector Search Form
        elements.vectorSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            executeVectorSearch();
        });

        // Settings Sliders
        elements.chunkSizeInput.addEventListener('input', (e) => elements.chunkSizeVal.textContent = e.target.value);
        elements.chunkOverlapInput.addEventListener('input', (e) => elements.chunkOverlapVal.textContent = e.target.value);
        elements.topKInput.addEventListener('input', (e) => elements.topKVal.textContent = e.target.value);

        // Toggle Key Visibility
        elements.toggleKeyVisibility.addEventListener('click', () => {
            const input = elements.geminiApiKeyInput;
            const icon = elements.toggleKeyVisibility.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fa-solid fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fa-solid fa-eye';
            }
        });

        elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
    }

    // =========================================================================
    // System Health & Data Fetching
    // =========================================================================

    async function fetchSystemHealth() {
        try {
            const res = await fetch('/api/health');
            if (!res.ok) return;
            const data = await res.json();

            elements.vectorStatusText.textContent = `RAG Engine Online`;
            elements.statTotalChunks.textContent = data.total_chunks;
            elements.statTotalDocs.textContent = data.documents_count;
            elements.navDocBadge.textContent = data.documents_count;

            const sbDoc = document.getElementById('sidebarDocCount');
            const sbChunk = document.getElementById('sidebarChunkCount');
            const sbIdx = document.getElementById('sidebarIndexedCount');
            if (sbDoc) sbDoc.textContent = data.documents_count;
            if (sbChunk) sbChunk.textContent = data.total_chunks;
            if (sbIdx) sbIdx.textContent = data.documents_count;

            state.hasGeminiKey = data.has_gemini_key;
            if (data.has_gemini_key) {
                elements.engineStatusText.textContent = 'RAG Engine: Gemini API';
            } else {
                elements.engineStatusText.textContent = 'RAG Engine: Local';
            }
        } catch (err) {
            console.error('Error fetching health:', err);
        }
    }

    async function fetchDocumentsList() {
        try {
            const res = await fetch('/api/documents');
            if (!res.ok) return;
            state.documents = await res.json();
            renderDocumentsTable(state.documents);
            elements.statTotalDocs.textContent = state.documents.length;
            elements.navDocBadge.textContent = state.documents.length;
        } catch (err) {
            console.error('Error fetching documents:', err);
        }
    }

    async function fetchSettings() {
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) return;
            const data = await res.json();

            elements.chunkSizeInput.value = data.chunk_size;
            elements.chunkSizeVal.textContent = data.chunk_size;
            elements.chunkOverlapInput.value = data.chunk_overlap;
            elements.chunkOverlapVal.textContent = data.chunk_overlap;
            elements.topKInput.value = data.top_k;
            elements.topKVal.textContent = data.top_k;

            if (data.gemini_api_key_masked) {
                elements.geminiApiKeyInput.placeholder = `Saved (${data.gemini_api_key_masked})`;
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    }

    // =========================================================================
    // Chat RAG Logic
    // =========================================================================

    function resetChat() {
        state.chatHistory = [];
        elements.chatMessages.innerHTML = '';
        elements.welcomeCard.style.display = 'block';
        showToast('Started new chat session.', 'info');
    }

    async function handleChatSubmit() {
        const query = elements.chatInput.value.strip ? elements.chatInput.value.strip() : elements.chatInput.value.trim();
        if (!query) return;

        // Hide welcome banner
        elements.welcomeCard.style.display = 'none';

        // Add user message bubble
        const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        appendUserMessage(query, userTimestamp);

        // Record in history
        state.chatHistory.push({ role: 'user', content: query });

        // Reset input field
        elements.chatInput.value = '';
        elements.sendBtn.disabled = true;

        // Show typing indicator
        elements.typingIndicator.style.display = 'flex';
        scrollToBottom();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: query,
                    history: state.chatHistory.slice(-6)
                })
            });

            elements.typingIndicator.style.display = 'none';
            elements.sendBtn.disabled = false;

            if (!res.ok) {
                const errData = await res.json();
                appendAiMessage("I encountered an error connecting to the library server. Please try again.", [], new Date().toLocaleTimeString(), "Error");
                showToast(errData.detail || "Error getting answer", "error");
                return;
            }

            const data = await res.json();
            const aiTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            appendAiMessage(data.answer, data.sources, aiTimestamp, data.engine);
            state.chatHistory.push({ role: 'assistant', content: data.answer });

        } catch (err) {
            elements.typingIndicator.style.display = 'none';
            elements.sendBtn.disabled = false;
            appendAiMessage("I couldn't reach the server. Please check your backend connection.", [], new Date().toLocaleTimeString(), "Network Error");
            showToast("Failed to connect to backend", "error");
        }
    }

    function appendUserMessage(text, timestamp) {
        const messageRow = document.createElement('div');
        messageRow.className = 'message-row user-row';
        messageRow.innerHTML = `
            <div class="avatar avatar-user">
                <i class="fa-solid fa-user"></i>
            </div>
            <div class="message-content">
                <div class="message-bubble">${escapeHtml(text)}</div>
                <div class="message-meta">${timestamp}</div>
            </div>
        `;
        elements.chatMessages.appendChild(messageRow);
        scrollToBottom();
    }

    function appendAiMessage(answer, sources, timestamp, engine) {
        const messageRow = document.createElement('div');
        messageRow.className = 'message-row ai-row';

        let sourcesHtml = '';
        if (sources && sources.length > 0) {
            sourcesHtml = `
                <div class="sources-container">
                    <div class="sources-title">
                        Sources
                    </div>
                    <div class="source-cards-list">
                        ${sources.map(src => {
                            const isPdf = src.document.toLowerCase().endsWith('.pdf');
                            const iconClass = isPdf ? 'fa-solid fa-file-pdf' : 'fa-regular fa-file-lines';
                            const scoreVal = typeof src.score === 'number' ? src.score : 0.90;
                            const scoreFormatted = scoreVal.toFixed(2);
                            return `
                                <div class="source-card-item">
                                    <div class="source-file-info">
                                        <i class="${iconClass}"></i>
                                        <div>
                                            <div class="source-doc-name">${escapeHtml(src.document)}</div>
                                            <div class="source-sec-name">${escapeHtml(src.section || 'General')}</div>
                                        </div>
                                    </div>
                                    <span class="relevance-badge">Relevance: ${scoreFormatted}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        const formattedAnswer = formatMarkdown(answer);

        messageRow.innerHTML = `
            <div class="avatar avatar-ai">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="message-bubble">${formattedAnswer}</div>
                ${sourcesHtml}
                <div class="message-meta">
                    <span>${timestamp}</span>
                    <span>•</span>
                    <span>${escapeHtml(engine || 'RAG Engine')}</span>
                </div>
            </div>
        `;

        elements.chatMessages.appendChild(messageRow);
        scrollToBottom();
    }

    function scrollToBottom() {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    // =========================================================================
    // Knowledge Base Dashboard Handlers
    // =========================================================================

    function renderDocumentsTable(docs) {
        if (!docs || docs.length === 0) {
            elements.documentsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 30px; color: var(--text-muted);">
                        No documents found in knowledge base. Click 'Upload Document' to add library resources.
                    </td>
                </tr>
            `;
            return;
        }

        elements.documentsTableBody.innerHTML = docs.map(doc => `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px; font-weight: 600;">
                        <i class="${getFileIcon(doc.file_type)}"></i>
                        ${escapeHtml(doc.filename)}
                    </div>
                </td>
                <td><span class="badge badge-accent">${doc.file_type}</span></td>
                <td><span class="badge status-success">${doc.status}</span></td>
                <td><strong>${doc.chunks_count}</strong> chunks</td>
                <td>${formatBytes(doc.file_size)}</td>
                <td>${doc.indexed_at}</td>
                <td class="text-right">
                    <button class="btn btn-secondary btn-sm" onclick="inspectDocumentChunks('${escapeHtml(doc.filename)}')">
                        <i class="fa-solid fa-eye"></i> View Chunks
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDocument('${escapeHtml(doc.filename)}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function filterDocumentsTable() {
        const query = elements.docTableSearch.value.toLowerCase();
        const filtered = state.documents.filter(d => d.filename.toLowerCase().includes(query));
        renderDocumentsTable(filtered);
    }

    async function triggerReindex() {
        elements.reindexBtn.disabled = true;
        elements.reindexBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Re-indexing...';

        try {
            const res = await fetch('/api/documents/reindex', { method: 'POST' });
            const data = await res.json();
            showToast(data.message || 'Re-indexing completed!', 'success');
            fetchSystemHealth();
            fetchDocumentsList();
        } catch (err) {
            showToast('Re-indexing failed.', 'error');
        } finally {
            elements.reindexBtn.disabled = false;
            elements.reindexBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Re-index All';
        }
    }

    // Modal Helpers
    function openModal(modal) {
        modal.classList.add('active');
    }
    function closeModal(modal) {
        modal.classList.remove('active');
    }

    // File Upload Handler
    let selectedFileObj = null;

    function handleFileSelect(file) {
        selectedFileObj = file;
        elements.selectedFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
        elements.dropzone.style.display = 'none';
        elements.selectedFileInfo.style.display = 'flex';
        elements.submitUploadBtn.disabled = false;
    }

    function clearFileSelect() {
        selectedFileObj = null;
        elements.fileInput.value = '';
        elements.dropzone.style.display = 'block';
        elements.selectedFileInfo.style.display = 'none';
        elements.submitUploadBtn.disabled = true;
    }

    async function uploadSelectedFile() {
        if (!selectedFileObj) return;

        const formData = new FormData();
        formData.append('file', selectedFileObj);

        elements.submitUploadBtn.disabled = true;
        elements.submitUploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ingesting...';

        try {
            const res = await fetch('/api/documents/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                showToast(err.detail || 'Upload failed', 'error');
                return;
            }

            const data = await res.json();
            showToast(data.message || 'File uploaded and indexed successfully!', 'success');
            closeModal(elements.uploadModal);
            clearFileSelect();
            fetchSystemHealth();
            fetchDocumentsList();
        } catch (err) {
            showToast('Failed to upload file to backend.', 'error');
        } finally {
            elements.submitUploadBtn.disabled = false;
            elements.submitUploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Start Upload & Index';
        }
    }

    // Global document delete function for inline table onclick
    window.deleteDocument = async function(filename) {
        if (!confirm(`Are you sure you want to delete '${filename}' from the library knowledge base?`)) return;

        try {
            const res = await fetch(`/api/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (!res.ok) {
                showToast('Failed to delete document.', 'error');
                return;
            }
            showToast(`Deleted document '${filename}'.`, 'success');
            fetchSystemHealth();
            fetchDocumentsList();
        } catch (err) {
            showToast('Error communicating with backend server.', 'error');
        }
    };

    // Global document chunk inspector function
    window.inspectDocumentChunks = async function(filename) {
        elements.chunkModalBody.innerHTML = '<div class="text-center" style="padding:20px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Loading chunk vectors...</p></div>';
        openModal(elements.chunkModal);

        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: filename.replace(/\.[^/.]+$/, ""), top_k: 20 })
            });

            const results = await res.json();
            const docChunks = results.filter(r => r.document === filename);

            if (docChunks.length === 0) {
                elements.chunkModalBody.innerHTML = `<p class="text-muted text-center" style="padding:30px;">No explicit chunk records found for ${escapeHtml(filename)}.</p>`;
                return;
            }

            elements.chunkModalBody.innerHTML = `
                <div style="margin-bottom:14px; font-weight:600; color:var(--accent-primary);">
                    Found ${docChunks.length} Chunks for Document: ${escapeHtml(filename)}
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${docChunks.map((chk, idx) => `
                        <div class="vector-result-card">
                            <div class="vector-result-header">
                                <span class="vector-result-title">Chunk #${chk.chunk_index + 1} | Section: ${escapeHtml(chk.section)}</span>
                                <span class="badge badge-accent">Length: ${chk.snippet.length} chars</span>
                            </div>
                            <div class="vector-result-snippet">${escapeHtml(chk.snippet)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (err) {
            elements.chunkModalBody.innerHTML = '<p class="text-danger">Failed to load chunks.</p>';
        }
    };

    // =========================================================================
    // Vector Search Explorer Handlers
    // =========================================================================

    async function executeVectorSearch() {
        const query = elements.vectorQueryInput.value.trim();
        if (!query) return;

        elements.vectorResultsContainer.innerHTML = `
            <div class="text-center" style="padding:40px; color:var(--text-secondary);">
                <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top:12px;">Executing Cosine Similarity Vector Search...</p>
            </div>
        `;

        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query, top_k: 6 })
            });

            if (!res.ok) {
                showToast('Vector search failed', 'error');
                return;
            }

            const data = await res.json();
            renderVectorResults(data);

        } catch (err) {
            showToast('Failed to connect to backend', 'error');
        }
    }

    function renderVectorResults(results) {
        if (!results || results.length === 0) {
            elements.vectorResultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-box-open"></i>
                    <h3>No Vector Matches Found</h3>
                    <p>Try refining your query or re-indexing the knowledge base.</p>
                </div>
            `;
            return;
        }

        elements.vectorResultsContainer.innerHTML = results.map(item => `
            <div class="vector-result-card">
                <div class="vector-result-header">
                    <div class="vector-result-title">
                        <i class="fa-regular fa-file-lines"></i> ${escapeHtml(item.document)}
                        <span style="font-weight:400; color:var(--text-secondary); font-size:12px;">(Section: ${escapeHtml(item.section)})</span>
                    </div>
                    <span class="score-badge">${Math.round(item.score * 100)}% Cosine Match</span>
                </div>
                <div class="vector-result-snippet">"${escapeHtml(item.snippet)}"</div>
            </div>
        `).join('');
    }

    // =========================================================================
    // Settings Handlers
    // =========================================================================

    async function handleSettingsSubmit(e) {
        e.preventDefault();
        const payload = {
            chunk_size: parseInt(elements.chunkSizeInput.value),
            chunk_overlap: parseInt(elements.chunkOverlapInput.value),
            top_k: parseInt(elements.topKInput.value)
        };

        const keyVal = elements.geminiApiKeyInput.value.trim();
        if (keyVal) {
            payload.gemini_api_key = keyVal;
        }

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                showToast('Failed to save settings', 'error');
                return;
            }

            showToast('Settings saved successfully!', 'success');
            elements.geminiApiKeyInput.value = '';
            fetchSystemHealth();
            fetchSettings();
        } catch (err) {
            showToast('Network error saving settings', 'error');
        }
    }

    // =========================================================================
    // Utility Helpers
    // =========================================================================

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconClass = type === 'success' ? 'fa-solid fa-circle-check' :
                          type === 'error' ? 'fa-solid fa-circle-xmark' :
                          'fa-solid fa-circle-info';
        
        toast.innerHTML = `<i class="${iconClass}"></i> <span>${escapeHtml(message)}</span>`;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function formatMarkdown(text) {
        if (!text) return '';
        let html = escapeHtml(text);
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Bullet points
        html = html.replace(/(?:^|\n)•\s*(.*?)(?=\n|$)/g, '<br>• $1');
        html = html.replace(/(?:^|\n)-\s*(.*?)(?=\n|$)/g, '<br>• $1');
        // Line breaks
        html = html.replace(/\n\n/g, '<br><br>');
        
        return html;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getFileIcon(type) {
        switch (type.toUpperCase()) {
            case 'PDF': return 'fa-solid fa-file-pdf text-danger';
            case 'DOCX': return 'fa-solid fa-file-word text-info';
            case 'TEXT': case 'TXT': return 'fa-solid fa-file-lines';
            case 'MARKDOWN': case 'MD': return 'fa-brands fa-markdown text-accent';
            default: return 'fa-solid fa-file';
        }
    }

    function formatBytes(bytes, decimals = 1) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
