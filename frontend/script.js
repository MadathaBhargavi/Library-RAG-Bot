/**
 * Book & Document RAG Assistant - Frontend Application JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://library-rag-bot.onrender.com';
    // State Management
    const state = {
        activeTab: 'chat',
        selectedDocumentId: 'all',
        chatHistory: [],
        documents: [],
        hasGeminiKey: false,
        theme: localStorage.getItem('document_rag_theme') || 'light'
    };

    // DOM Elements
    const elements = {
        // Sidebar & Topbar
        sidebar: document.getElementById('sidebar'),
        openSidebarBtn: document.getElementById('openSidebarBtn'),
        closeSidebarBtn: document.getElementById('closeSidebarBtn'),
        pageTitle: document.getElementById('pageTitle'),
        pageSubtitle: document.getElementById('pageSubtitle'),
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        navItems: document.querySelectorAll('.nav-item'),
        tabViews: document.querySelectorAll('.tab-view'),
        newChatBtn: document.getElementById('newChatBtn'),
        navDocBadge: document.getElementById('navDocBadge'),
        sidebarDocList: document.getElementById('sidebarDocList'),
        sidebarDocCount: document.getElementById('sidebarDocCount'),
        sidebarChunkCount: document.getElementById('sidebarChunkCount'),
        sidebarEngineType: document.getElementById('sidebarEngineType'),
        refreshStatusBtn: document.getElementById('refreshStatusBtn'),

        // Chat Selectors & Banners
        chatDocSelector: document.getElementById('chatDocSelector'),
        searchDocFilterSelect: document.getElementById('searchDocFilterSelect'),
        selectedDocBanner: document.getElementById('selectedDocBanner'),
        activeDocNameText: document.getElementById('activeDocNameText'),
        activeDocStatusText: document.getElementById('activeDocStatusText'),
        vectorStatusPill: document.getElementById('vectorStatusPill'),
        vectorStatusText: document.getElementById('vectorStatusText'),

        // Chat Elements
        welcomeCard: document.getElementById('welcomeCard'),
        heroUploadBtn: document.getElementById('heroUploadBtn'),
        chatMessages: document.getElementById('chatMessages'),
        typingIndicator: document.getElementById('typingIndicator'),
        chatForm: document.getElementById('chatForm'),
        chatInput: document.getElementById('chatInput'),
        sendBtn: document.getElementById('sendBtn'),
        chatAttachBtn: document.getElementById('chatAttachBtn'),
        suggestedPills: document.getElementById('suggestedPills'),

        // Right Panel Elements
        rightScopeVal: document.getElementById('rightScopeVal'),
        rightChunksVal: document.getElementById('rightChunksVal'),
        goToDocsBtn: document.getElementById('goToDocsBtn'),
        quickUploadBtn: document.getElementById('quickUploadBtn'),
        quickReindexBtn: document.getElementById('quickReindexBtn'),
        quickClearBtn: document.getElementById('quickClearBtn'),

        // My Documents Tab Elements
        documentsTabDropzone: document.getElementById('documentsTabDropzone'),
        dropzoneBrowseBtn: document.getElementById('dropzoneBrowseBtn'),
        documentsTabFileInput: document.getElementById('documentsTabFileInput'),
        reindexAllBtn: document.getElementById('reindexAllBtn'),
        refreshDocsBtn: document.getElementById('refreshDocsBtn'),
        documentsTableBody: document.getElementById('documentsTableBody'),
        docTableSearch: document.getElementById('docTableSearch'),

        // Vector Search Tab Elements
        vectorSearchForm: document.getElementById('vectorSearchForm'),
        vectorQueryInput: document.getElementById('vectorQueryInput'),
        vectorResultsContainer: document.getElementById('vectorResultsContainer'),

        // Dashboard Tab Elements
        dashTotalDocs: document.getElementById('dashTotalDocs'),
        dashTotalChunks: document.getElementById('dashTotalChunks'),
        dashTotalQueries: document.getElementById('dashTotalQueries'),
        dashEngineName: document.getElementById('dashEngineName'),
        dashGeminiKeyStatus: document.getElementById('dashGeminiKeyStatus'),

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

        // Upload Modal Elements
        uploadModal: document.getElementById('uploadModal'),
        closeUploadModalBtn: document.getElementById('closeUploadModalBtn'),
        cancelUploadBtn: document.getElementById('cancelUploadBtn'),
        modalDropzone: document.getElementById('modalDropzone'),
        modalFileInput: document.getElementById('modalFileInput'),
        modalSelectedFileInfo: document.getElementById('modalSelectedFileInfo'),
        modalSelectedFileName: document.getElementById('modalSelectedFileName'),
        modalRemoveFileBtn: document.getElementById('modalRemoveFileBtn'),
        submitUploadBtn: document.getElementById('submitUploadBtn'),

        // Summary Modal Elements
        summaryModal: document.getElementById('summaryModal'),
        closeSummaryModalBtn: document.getElementById('closeSummaryModalBtn'),
        closeSummaryBtn: document.getElementById('closeSummaryBtn'),
        summaryDocName: document.getElementById('summaryDocName'),
        summaryContentBox: document.getElementById('summaryContentBox'),
        summaryTypeBtns: document.querySelectorAll('.summary-type-btn'),

        // Toast Container
        toastContainer: document.getElementById('toastContainer')
    };

    let currentSummaryFilename = '';
    let selectedUploadFile = null;

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
        localStorage.setItem('document_rag_theme', theme);
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

        // Update Header Titles based on tab
        const titles = {
            'chat': { title: 'Book & Document RAG Assistant', sub: 'Ask questions about your uploaded books and documents' },
            'documents': { title: 'Document Library ("My Documents")', sub: 'Upload, manage, summarize, and search your document collection' },
            'vector-search': { title: 'Inside Document Search', sub: 'Perform semantic and keyword search across indexed document passages' },
            'dashboard': { title: 'RAG Analytics Dashboard', sub: 'System health, indexed chunks, and vector store stats' },
            'settings': { title: 'RAG Parameters & Settings', sub: 'Configure chunk sizes, similarity thresholds, and AI models' }
        };

        if (titles[tabId]) {
            elements.pageTitle.textContent = titles[tabId].title;
            elements.pageSubtitle.textContent = titles[tabId].sub;
        }

        // Close sidebar on mobile
        elements.sidebar.classList.remove('mobile-open');

        if (tabId === 'documents') fetchDocumentsList();
        if (tabId === 'dashboard') fetchSystemHealth();
    }

    function setupEventListeners() {
        // Theme Toggle
        elements.themeToggleBtn.addEventListener('click', () => {
            const nextTheme = state.theme === 'light' ? 'dark' : 'light';
            applyTheme(nextTheme);
        });

        // Mobile Sidebar Toggle
        elements.openSidebarBtn.addEventListener('click', () => {
            elements.sidebar.classList.add('mobile-open');
        });

        elements.closeSidebarBtn.addEventListener('click', () => {
            elements.sidebar.classList.remove('mobile-open');
        });

        // Navigation Click
        elements.navItems.forEach(item => {
            item.addEventListener('click', () => {
                switchTab(item.dataset.tab);
            });
        });

        // Document Target Selector Change
        elements.chatDocSelector.addEventListener('change', (e) => {
            state.selectedDocumentId = e.target.value;
            updateSelectedDocUI();
        });

        if (elements.searchDocFilterSelect) {
            elements.searchDocFilterSelect.addEventListener('change', (e) => {
                state.selectedDocumentId = e.target.value;
            });
        }

        // Chat Form Submit
        elements.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleChatSubmit();
        });

        // Chat Auto-grow Textarea
        elements.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit();
            }
        });

        // Suggested Question Pills
        elements.suggestedPills.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill-btn');
            if (pill && pill.dataset.query) {
                elements.chatInput.value = pill.dataset.query;
                handleChatSubmit();
            }
        });

        // Quick Actions
        elements.newChatBtn.addEventListener('click', clearChatHistory);
        elements.quickClearBtn.addEventListener('click', clearChatHistory);
        elements.quickReindexBtn.addEventListener('click', triggerReindex);
        elements.reindexAllBtn?.addEventListener('click', triggerReindex);
        elements.refreshDocsBtn?.addEventListener('click', fetchDocumentsList);
        elements.refreshStatusBtn?.addEventListener('click', fetchSystemHealth);

        elements.goToDocsBtn.addEventListener('click', () => switchTab('documents'));
        elements.heroUploadBtn?.addEventListener('click', openUploadModal);
        elements.quickUploadBtn.addEventListener('click', openUploadModal);
        elements.chatAttachBtn.addEventListener('click', openUploadModal);

        // Upload Modal Handlers
        elements.closeUploadModalBtn.addEventListener('click', closeUploadModal);
        elements.cancelUploadBtn.addEventListener('click', closeUploadModal);

        elements.modalDropzone.addEventListener('click', () => elements.modalFileInput.click());
        elements.modalFileInput.addEventListener('change', (e) => handleFileSelected(e.target.files[0]));

        elements.modalDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.modalDropzone.classList.add('drag-over');
        });

        elements.modalDropzone.addEventListener('dragleave', () => elements.modalDropzone.classList.remove('drag-over'));
        elements.modalDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.modalDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                handleFileSelected(e.dataTransfer.files[0]);
            }
        });

        elements.modalRemoveFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetModalFileInput();
        });

        elements.submitUploadBtn.addEventListener('click', handleFileUpload);

        // Documents Tab Dropzone
        if (elements.documentsTabDropzone) {
            elements.documentsTabDropzone.addEventListener('click', () => elements.documentsTabFileInput.click());
            elements.dropzoneBrowseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.documentsTabFileInput.click();
            });
            elements.documentsTabFileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    handleFileSelected(e.target.files[0]);
                    openUploadModal();
                }
            });
        }

        // Summary Modal Handlers
        elements.closeSummaryModalBtn?.addEventListener('click', closeSummaryModal);
        elements.closeSummaryBtn?.addEventListener('click', closeSummaryModal);

        elements.summaryTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.summaryTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (currentSummaryFilename) {
                    fetchDocumentSummary(currentSummaryFilename, btn.dataset.type);
                }
            });
        });

        // Document Table Search Filter
        elements.docTableSearch?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const rows = elements.documentsTableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });

        // Inside Document Vector Search Form
        elements.vectorSearchForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            handleVectorSearch();
        });

        // Settings Sliders & Form
        elements.chunkSizeInput?.addEventListener('input', (e) => elements.chunkSizeVal.textContent = e.target.value);
        elements.chunkOverlapInput?.addEventListener('input', (e) => elements.chunkOverlapVal.textContent = e.target.value);
        elements.topKInput?.addEventListener('input', (e) => elements.topKVal.textContent = e.target.value);

        elements.toggleKeyVisibility?.addEventListener('click', () => {
            const type = elements.geminiApiKeyInput.type === 'password' ? 'text' : 'password';
            elements.geminiApiKeyInput.type = type;
            elements.toggleKeyVisibility.querySelector('i').className = type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        });

        elements.settingsForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSettingsSave();
        });
    }

    // =========================================================================
    // API Integration Functions
    // =========================================================================

    async function fetchSystemHealth() {
        try {
            const res = await fetch('${ API_BASE_URL } / api / health');
            if (!res.ok) throw new Error('Health check failed');
            const data = await res.json();

            elements.sidebarDocCount.textContent = data.documents_count;
            elements.sidebarChunkCount.textContent = data.total_chunks;
            if (elements.dashTotalDocs) elements.dashTotalDocs.textContent = data.documents_count;
            if (elements.dashTotalChunks) elements.dashTotalChunks.textContent = data.total_chunks;
            if (elements.dashTotalQueries) elements.dashTotalQueries.textContent = data.queries_count || 0;

            const hasKey = data.has_gemini_key;
            state.hasGeminiKey = hasKey;

            const engineName = hasKey ? 'Google Gemini API (gemini-2.5-flash)' : 'Precision Local RAG Engine';
            elements.sidebarEngineType.textContent = hasKey ? 'Gemini 2.5' : 'Local Precision';
            if (elements.dashEngineName) elements.dashEngineName.textContent = engineName;
            if (elements.dashGeminiKeyStatus) {
                elements.dashGeminiKeyStatus.textContent = hasKey ? 'Active (Connected)' : 'None (Using Local RAG Engine)';
            }
        } catch (err) {
            console.error('[Health Fetch Error]:', err);
            elements.vectorStatusPill.className = 'rag-status-badge badge-warning';
            elements.vectorStatusText.textContent = 'RAG Offline';
        }
    }

    async function fetchDocumentsList() {
        try {
            const res = await fetch('${ API_BASE_URL}/api/documents');
            if (!res.ok) throw new Error('Failed to load documents');
            const docs = await res.json();
            state.documents = docs;

            renderDocumentsTable(docs);
            renderDocumentSelectors(docs);
            renderSidebarDocList(docs);

            if (elements.navDocBadge) {
                elements.navDocBadge.textContent = docs.length;
                elements.navDocBadge.style.display = docs.length > 0 ? 'inline-block' : 'none';
            }
        } catch (err) {
            console.error('[Fetch Documents Error]:', err);
            showToast('Error loading document library', 'error');
        }
    }

    function renderDocumentSelectors(docs) {
        let optionsHtml = `<option value="all">🌐 All Uploaded Documents (${docs.length})</option>`;
        docs.forEach(doc => {
            const selected = doc.filename === state.selectedDocumentId ? 'selected' : '';
            optionsHtml += `<option value="${doc.filename}" ${selected}>📄 ${doc.filename} (${doc.chunks_count} chunks)</option>`;
        });

        elements.chatDocSelector.innerHTML = optionsHtml;
        if (elements.searchDocFilterSelect) {
            elements.searchDocFilterSelect.innerHTML = optionsHtml;
        }

        updateSelectedDocUI();
    }

    function updateSelectedDocUI() {
        const isAll = state.selectedDocumentId === 'all';
        const activeDoc = state.documents.find(d => d.filename === state.selectedDocumentId);

        if (isAll) {
            elements.activeDocNameText.textContent = 'Querying across all uploaded documents';
            elements.activeDocStatusText.textContent = `✓ ${state.documents.length} Docs Indexed`;
            if (elements.rightScopeVal) elements.rightScopeVal.textContent = 'All Uploaded Documents';
            if (elements.rightChunksVal) {
                const totalChunks = state.documents.reduce((acc, d) => acc + d.chunks_count, 0);
                elements.rightChunksVal.textContent = totalChunks;
            }
        } else if (activeDoc) {
            elements.activeDocNameText.textContent = `📄 Selected Document: ${activeDoc.filename}`;
            elements.activeDocStatusText.textContent = `✓ ${activeDoc.chunks_count} Chunks Indexed`;
            if (elements.rightScopeVal) elements.rightScopeVal.textContent = activeDoc.filename;
            if (elements.rightChunksVal) elements.rightChunksVal.textContent = activeDoc.chunks_count;
        }
    }

    function renderSidebarDocList(docs) {
        if (!docs.length) {
            elements.sidebarDocList.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:8px;">No documents uploaded yet</div>`;
            return;
        }

        let html = '';
        docs.forEach(doc => {
            const isActive = doc.filename === state.selectedDocumentId;
            html += `
                <div class="history-item ${isActive ? 'active' : ''}" data-filename="${doc.filename}">
                    <i class="fa-solid fa-file-contract"></i>
                    <div class="history-text-wrap">
                        <span class="history-title">${doc.filename}</span>
                        <span class="history-time">${doc.chunks_count} Chunks | ${doc.file_type}</span>
                    </div>
                </div>
            `;
        });

        elements.sidebarDocList.innerHTML = html;

        elements.sidebarDocList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const filename = item.dataset.filename;
                state.selectedDocumentId = filename;
                elements.chatDocSelector.value = filename;
                updateSelectedDocUI();
                switchTab('chat');
            });
        });
    }

    function renderDocumentsTable(docs) {
        if (!docs.length) {
            elements.documentsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
                        <i class="fa-solid fa-folder-open" style="font-size:32px; margin-bottom:8px; display:block;"></i>
                        No books or documents uploaded yet. Drag & drop a file to get started!
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        docs.forEach(doc => {
            const sizeMb = (doc.file_size / (1024 * 1024)).toFixed(2);
            const pageStr = doc.pages_count ? `${doc.pages_count} Pages` : 'N/A';

            html += `
                <tr>
                    <td style="font-weight:600;"><i class="fa-solid fa-file-pdf" style="color:var(--accent-blue); margin-right:6px;"></i> ${doc.filename}</td>
                    <td><span class="badge-green">${doc.file_type}</span></td>
                    <td>${sizeMb} MB</td>
                    <td>${pageStr}</td>
                    <td><strong>${doc.chunks_count}</strong></td>
                    <td><span class="badge-green">Indexed</span></td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-action-sm action-chat-btn" data-filename="${doc.filename}" title="Ask questions about this book">
                                <i class="fa-solid fa-comments"></i> Ask
                            </button>
                            <button class="btn-action-sm action-summary-btn" data-filename="${doc.filename}" title="Generate Summary">
                                <i class="fa-solid fa-align-left"></i> Summary
                            </button>
                            <button class="btn-action-sm btn-action-danger action-delete-btn" data-filename="${doc.filename}" title="Delete Document">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        elements.documentsTableBody.innerHTML = html;

        // Attach action handlers
        elements.documentsTableBody.querySelectorAll('.action-chat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filename = btn.dataset.filename;
                state.selectedDocumentId = filename;
                elements.chatDocSelector.value = filename;
                updateSelectedDocUI();
                switchTab('chat');
            });
        });

        elements.documentsTableBody.querySelectorAll('.action-summary-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                openSummaryModal(btn.dataset.filename);
            });
        });

        elements.documentsTableBody.querySelectorAll('.action-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleDeleteDocument(btn.dataset.filename);
            });
        });
    }

    // =========================================================================
    // Chat Submission & RAG Answer Generation
    // =========================================================================

    async function handleChatSubmit() {
        const query = elements.chatInput.value.trim();
        if (!query) return;

        // Hide welcome hero card
        if (elements.welcomeCard) elements.welcomeCard.style.display = 'none';

        // Render User Message Bubble
        appendMessage('user', query);
        elements.chatInput.value = '';
        elements.chatInput.style.height = 'auto';

        // Show Typing Indicator
        elements.typingIndicator.style.display = 'flex';
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

        const requestPayload = {
            message: query,
            document_id: state.selectedDocumentId === 'all' ? null : state.selectedDocumentId,
            history: state.chatHistory.slice(-4)
        };

        try {
            const res = await fetch('${API_BASE_URL}/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });

            elements.typingIndicator.style.display = 'none';

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to generate answer');
            }

            const data = await res.json();

            // Store history
            state.chatHistory.push({ role: 'user', content: query });
            state.chatHistory.push({ role: 'assistant', content: data.answer });

            // Render AI Response with real sources & expandable retrieved context
            appendAssistantMessage(data);

        } catch (err) {
            elements.typingIndicator.style.display = 'none';
            appendMessage('assistant', `⚠️ An error occurred while retrieving document content: ${err.message}`);
            console.error('[Chat API Error]:', err);
        }
    }

    function appendMessage(role, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message message-${role}`;

        const avatarIcon = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
        const avatarClass = role === 'user' ? 'avatar-user' : 'avatar-ai';

        msgDiv.innerHTML = `
            <div class="avatar ${avatarClass}">${avatarIcon}</div>
            <div class="message-bubble">
                <div class="message-text">${formatMarkdown(text)}</div>
            </div>
        `;

        elements.chatMessages.appendChild(msgDiv);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    function appendAssistantMessage(data) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message message-assistant';

        let sourcesHtml = '';
        if (data.sources && data.sources.length > 0) {
            sourcesHtml += `<div class="message-sources"><div class="sources-title"><i class="fa-solid fa-book-bookmark"></i> Real Sources:</div><div class="sources-tags">`;
            data.sources.forEach(src => {
                const pageStr = src.page ? ` - Page ${src.page}` : '';
                sourcesHtml += `<span class="source-tag"><i class="fa-solid fa-file-lines"></i> ${src.document}${pageStr} (${src.section})</span>`;
            });
            sourcesHtml += `</div></div>`;
        }

        // Expandable Retrieved Context Accordion
        let accordionHtml = '';
        if (data.retrieved_context && data.retrieved_context.length > 0) {
            accordionHtml += `
                <div class="context-accordion">
                    <div class="context-accordion-header">
                        <span><i class="fa-solid fa-layer-group"></i> View Retrieved Context Chunks (${data.retrieved_context.length})</span>
                        <i class="fa-solid fa-chevron-down toggle-icon"></i>
                    </div>
                    <div class="context-accordion-body">
            `;

            data.retrieved_context.forEach((chk, idx) => {
                const pageStr = chk.page ? ` | Page ${chk.page}` : '';
                accordionHtml += `
                    <div class="context-chunk-card">
                        <div class="context-chunk-meta">
                            <span>Chunk #${idx + 1}: ${chk.document}${pageStr} (${chk.section})</span>
                            <span class="context-score-badge">Similarity: ${chk.score}</span>
                        </div>
                        <div class="context-chunk-text">${escapeHtml(chk.snippet)}</div>
                    </div>
                `;
            });

            accordionHtml += `
                    </div>
                </div>
            `;
        }

        msgDiv.innerHTML = `
            <div class="avatar avatar-ai"><i class="fa-solid fa-robot"></i></div>
            <div class="message-bubble">
                <div class="message-text">${formatMarkdown(data.answer)}</div>
                ${sourcesHtml}
                ${accordionHtml}
            </div>
        `;

        // Attach Accordion Toggle Event
        const accordionHeader = msgDiv.querySelector('.context-accordion-header');
        if (accordionHeader) {
            accordionHeader.addEventListener('click', () => {
                const body = msgDiv.querySelector('.context-accordion-body');
                const icon = msgDiv.querySelector('.toggle-icon');
                const isHidden = body.style.display !== 'flex';
                body.style.display = isHidden ? 'flex' : 'none';
                icon.className = isHidden ? 'fa-solid fa-chevron-up toggle-icon' : 'fa-solid fa-chevron-down toggle-icon';
            });
        }

        elements.chatMessages.appendChild(msgDiv);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    function clearChatHistory() {
        state.chatHistory = [];
        elements.chatMessages.innerHTML = '';
        if (elements.welcomeCard) elements.welcomeCard.style.display = 'flex';
        showToast('Chat history cleared', 'info');
    }

    // =========================================================================
    // Document Upload Modal & Processing
    // =========================================================================

    function openUploadModal() {
        resetModalFileInput();
        elements.uploadModal.classList.add('active');
    }

    function closeUploadModal() {
        elements.uploadModal.classList.remove('active');
        resetModalFileInput();
    }

    function handleFileSelected(file) {
        if (!file) return;
        selectedUploadFile = file;
        elements.modalSelectedFileName.textContent = file.name;
        elements.modalSelectedFileInfo.style.display = 'flex';
        elements.submitUploadBtn.disabled = false;
    }

    function resetModalFileInput() {
        selectedUploadFile = null;
        elements.modalFileInput.value = '';
        elements.modalSelectedFileInfo.style.display = 'none';
        elements.submitUploadBtn.disabled = true;
    }

    async function handleFileUpload() {
        if (!selectedUploadFile) return;

        const formData = new FormData();
        formData.append('file', selectedUploadFile);

        elements.submitUploadBtn.disabled = true;
        elements.submitUploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing & Indexing...`;

        try {
            const res = await fetch('${API_BASE_URL}/api/documents/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Upload failed');
            }

            const data = await res.json();
            showToast(`✓ Document '${data.filename}' successfully uploaded and indexed!`, 'success');

            closeUploadModal();
            fetchDocumentsList();
            fetchSystemHealth();

        } catch (err) {
            showToast(`Upload Error: ${err.message}`, 'error');
            elements.submitUploadBtn.disabled = false;
            elements.submitUploadBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Upload & Index`;
        }
    }

    async function handleDeleteDocument(filename) {
        if (!confirm(`Are you sure you want to delete '${filename}'? This will remove its vector index.`)) return;

        try {
            const res = await fetch(`/api/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');

            showToast(`Document '${filename}' deleted.`, 'info');
            if (state.selectedDocumentId === filename) {
                state.selectedDocumentId = 'all';
            }
            fetchDocumentsList();
            fetchSystemHealth();
        } catch (err) {
            showToast(`Delete failed: ${err.message}`, 'error');
        }
    }

    async function triggerReindex() {
        showToast('Re-indexing vector store knowledge base...', 'info');
        try {
            const res = await fetch('/api/documents/reindex', { method: 'POST' });
            if (!res.ok) throw new Error('Re-indexing failed');
            const data = await res.json();

            showToast(`✓ Knowledge base re-indexed (${data.total_chunks} chunks).`, 'success');
            fetchDocumentsList();
            fetchSystemHealth();
        } catch (err) {
            showToast(`Re-indexing Error: ${err.message}`, 'error');
        }
    }

    // =========================================================================
    // Summarization Feature
    // =========================================================================

    function openSummaryModal(filename) {
        currentSummaryFilename = filename;
        elements.summaryDocName.textContent = filename;
        elements.summaryContentBox.textContent = 'Generating grounded summary...';
        elements.summaryModal.classList.add('active');

        // Reset to full summary
        elements.summaryTypeBtns.forEach(b => b.classList.remove('active'));
        elements.summaryTypeBtns[0].classList.add('active');

        fetchDocumentSummary(filename, 'full');
    }

    function closeSummaryModal() {
        elements.summaryModal.classList.remove('active');
        currentSummaryFilename = '';
    }

    async function fetchDocumentSummary(filename, summaryType) {
        try {
            const res = await fetch(`/api/documents/${encodeURIComponent(filename)}/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary_type: summaryType })
            });

            if (!res.ok) throw new Error('Failed to summarize document');
            const data = await res.json();

            elements.summaryContentBox.innerHTML = formatMarkdown(data.summary);
        } catch (err) {
            elements.summaryContentBox.textContent = `Error generating summary: ${err.message}`;
        }
    }

    // =========================================================================
    // Inside Document Search & Settings
    // =========================================================================

    async function handleVectorSearch() {
        const query = elements.vectorQueryInput.value.trim();
        if (!query) return;

        elements.vectorResultsContainer.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Searching document passages...</div>`;

        try {
            const res = await fetch('${API_BASE_URL}/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    document_id: state.selectedDocumentId === 'all' ? null : state.selectedDocumentId,
                    top_k: 8
                })
            });

            if (!res.ok) throw new Error('Search failed');
            const results = await res.json();

            if (!results.length) {
                elements.vectorResultsContainer.innerHTML = `<div style="padding:20px; color:var(--text-muted); text-align:center;">No matching passages found.</div>`;
                return;
            }

            let html = '';
            results.forEach((item, idx) => {
                const pageStr = item.page ? ` | Page ${item.page}` : '';
                html += `
                    <div class="panel-card" style="margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:700; font-size:13px;"><i class="fa-solid fa-file-lines" style="color:var(--accent-blue);"></i> Passage #${idx + 1}: ${item.document}${pageStr} (${item.section})</span>
                            <span class="context-score-badge">Cosine Score: ${item.score}</span>
                        </div>
                        <div style="font-family:var(--font-code); font-size:12px; line-height:1.5; background:var(--bg-app); padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color); white-space:pre-wrap;">${escapeHtml(item.snippet)}</div>
                    </div>
                `;
            });

            elements.vectorResultsContainer.innerHTML = html;

        } catch (err) {
            elements.vectorResultsContainer.innerHTML = `<div style="padding:20px; color:var(--danger-red);">Search Error: ${err.message}</div>`;
        }
    }

    async function fetchSettings() {
        try {
            const res = await fetch('${API_BASE_URL}/api/settings');
            if (!res.ok) return;
            const data = await res.json();

            if (elements.chunkSizeInput) {
                elements.chunkSizeInput.value = data.chunk_size;
                elements.chunkSizeVal.textContent = data.chunk_size;
            }
            if (elements.chunkOverlapInput) {
                elements.chunkOverlapInput.value = data.chunk_overlap;
                elements.chunkOverlapVal.textContent = data.chunk_overlap;
            }
            if (elements.topKInput) {
                elements.topKInput.value = data.top_k;
                elements.topKVal.textContent = data.top_k;
            }
            if (data.has_gemini_key && elements.geminiApiKeyInput) {
                elements.geminiApiKeyInput.placeholder = `Configured (${data.gemini_api_key_masked})`;
            }
        } catch (err) {
            console.error('[Fetch Settings Error]:', err);
        }
    }

    async function handleSettingsSave() {
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

            if (!res.ok) throw new Error('Failed to update settings');
            showToast('Settings saved successfully.', 'success');
            elements.geminiApiKeyInput.value = '';
            fetchSettings();
            fetchSystemHealth();

        } catch (err) {
            showToast(`Settings Error: ${err.message}`, 'error');
        }
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    function escapeHtml(text) {
        return (text || '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatMarkdown(text) {
        if (!text) return '';
        let str = escapeHtml(text);

        // Bold
        str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Inline Code
        str = str.replace(/`([^`]+)`/g, '<code style="background:var(--bg-hero); padding:2px 6px; border-radius:4px; font-family:var(--font-code); font-size:12px;">$1</code>');
        // Line breaks
        str = str.replace(/\n/g, '<br>');

        return str;
    }
});