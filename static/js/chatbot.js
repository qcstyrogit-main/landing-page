(() => {
  const bubble = document.getElementById('chat-bubble');
  const panel = document.getElementById('chatbot-panel');
  const closeBtn = document.getElementById('chatbot-close');
  const form = document.getElementById('chatbot-form');
  const input = document.getElementById('chatbot-input');
  const messagesEl = document.getElementById('chatbot-messages');
  const statusEl = document.getElementById('chatbot-status');
  const nameInput = document.getElementById('chatbot-name');
  const emailInput = document.getElementById('chatbot-email');
  const unreadBadge = document.getElementById('chat-unread-badge');
  const typingIndicator = document.getElementById('chat-typing');
  const typingText = document.getElementById('chat-typing-text');
  const verifyPanel = document.getElementById('chatbot-verify');
  const altchaWidget = document.getElementById('chatbot-altcha');
  const verifyStatus = document.getElementById('chatbot-verify-status');

  if (!bubble || !panel || !form || !input || !messagesEl) return;

  const baseUrl = (panel.getAttribute('data-clefincode-base') || '').replace(/\/$/, '');
  const endpoints = baseUrl
    ? {
        create: `${baseUrl}/api/method/clefincode_chat.api.api_1_0_1.chat_portal.create_guest_profile_and_channel`,
        send: `${baseUrl}/api/method/clefincode_chat.api.api_1_0_1.chat_portal.send`,
        messages: `${baseUrl}/api/method/clefincode_chat.api.api_1_0_1.chat_portal.get_messages`
      }
    : {
        create: '/api/clefincode/create',
        send: '/api/clefincode/send',
        messages: '/api/clefincode/messages'
      };

  const storageKey = 'clefincode_chat_state';
  let chatState = loadState();
  let pollingId = null;
  const seenMessageIds = new Set();
  const seenMessageKeys = new Set();
  let unreadCount = 0;
  const pendingOutbound = [];
  let typingTimeoutId = null;
  let greetingShown = false;
  let agentActive = false;
  const historyKey = 'chatbot_history';
  const initKey = 'chatbot_initialized';
  const maxHistory = 100;
  let isRestoring = false;
  let handoffEnabled = false;
  const autoFlow = {
    stage: 'intro',
    topic: null,
    lastQuestion: ''
  };
  const defaultTopics = [
    {
      id: 'careers',
      label: 'Careers',
      reply: 'You can view openings on the Jobs page and apply directly. Roles update daily.'
    },
    {
      id: 'products',
      label: 'Products',
      reply: 'We offer plastic and styrofoam packaging products. Tell us what you need and we will help.'
    },
    {
      id: 'orders',
      label: 'Orders',
      reply: 'For orders, please share product name, quantity, and delivery location.'
    },
    {
      id: 'support',
      label: 'Support',
      reply: 'For support, describe the issue and we will assist you as soon as possible.'
    }
  ];
  let topics = defaultTopics.slice();
  let dynamicGreeting = '';
  const verifyKey = 'chatbot_verified_altcha';
  let idlePromptReady = false;

  hydrateIdentity();
  loadHistory();
  if (isVerified()) initIdlePrompt();
  if (chatState.room) {
    fetchMessages();
    startPolling();
  }

  const topicsPromise = loadTopics();

  bubble.addEventListener('click', () => {
    togglePanel(true);
    fetchMessages();
  });
  if (closeBtn) closeBtn.addEventListener('click', () => togglePanel(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') togglePanel(false);
  });

  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isVerified()) {
      setStatus('Please complete the human check.');
      updateVerificationUI();
      return;
    }
    const content = input.value.trim();
    if (!content) return;

    const sender = getSenderName();
    const senderEmail = getSenderEmail();

    const outboundKey = buildMessageKey({
      sender,
      content,
      sendDate: Date.now()
    });
    pendingOutbound.push({ content, at: Date.now(), key: outboundKey });
    input.value = '';
    setStatus('Sending...');
    

    try {
      if (!handoffEnabled && !agentActive) {
        handleAutoFlow(content);
        setStatus('Delivered');
        return;
      }
      if (!chatState.room) {
        await createGuestRoom({ content, sender, senderEmail });
        startPolling();
      }
      await sendMessage({ content, sender, senderEmail });

      setStatus('Delivered');
      await fetchMessages();
    } catch (error) {
      setStatus('Unable to send right now.');
      console.error('Chatbot error:', error);
    }
  });

  function togglePanel(open) {
    if (open) {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      panel.removeAttribute('inert');
      updateVerificationUI();
      if (isVerified()) {
        input.focus();
      }
      clearUnread();
      startPolling();
      if (topicsPromise && typeof topicsPromise.then === 'function') {
        topicsPromise.then(() => showGreeting());
      } else {
        showGreeting();
      }
    } else {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('inert', '');
    }
  }

  function isVerified() {
    return sessionStorage.getItem(verifyKey) === '1';
  }

  function setVerified(value) {
    if (value) {
      sessionStorage.setItem(verifyKey, '1');
    } else {
      sessionStorage.removeItem(verifyKey);
    }
  }

  function updateVerificationUI() {
    if (!verifyPanel || !form) return;
    const verified = isVerified();
    verifyPanel.style.display = verified ? 'none' : 'block';
    form.style.display = verified ? 'flex' : 'none';
  }

  if (altchaWidget) {
    altchaWidget.addEventListener('statechange', (event) => {
      const state = event?.detail?.state;
      if (!verifyStatus) return;
      if (state === 'verifying') {
        verifyStatus.textContent = 'Verifying...';
      } else if (state === 'verified') {
        verifyStatus.textContent = 'Verified! You can now chat.';
      } else if (state === 'error') {
        verifyStatus.textContent = 'Verification failed. Try again.';
      }
    });

    altchaWidget.addEventListener('verified', () => {
      setVerified(true);
      updateVerificationUI();
      input.focus();
      initIdlePrompt();
    });
  }

  function startPolling() {
    if (!chatState.room || pollingId) return;
    pollingId = window.setInterval(fetchMessages, 3000);
  }

  function stopPolling() {
    if (!pollingId) return;
    window.clearInterval(pollingId);
    pollingId = null;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function appendMessage({ content, outbound, id, isHtml, key, timestamp, pending, sender, sendDate }) {
    if (!content) return;
    if (id && seenMessageIds.has(id)) return;
    if (key && seenMessageKeys.has(key)) return;
    if (!id && outbound && isRecentDuplicate(content)) return;
    if (id) seenMessageIds.add(id);
    if (key) seenMessageKeys.add(key);

    const bubble = document.createElement('div');
    bubble.className = `chatbot-message ${outbound ? 'outbound' : 'inbound'}`;
    const contentEl = document.createElement('div');
    contentEl.className = 'chatbot-message-content';
    if (isHtml) {
      const sanitized = sanitizeHtml(content);
      contentEl.innerHTML = sanitized || formatMessage(stripHtml(content));
    } else {
      contentEl.innerHTML = formatMessage(content);
    }

    const timeEl = document.createElement('div');
    timeEl.className = 'chatbot-message-time';
    timeEl.textContent = formatTimestamp(timestamp);

    bubble.appendChild(contentEl);
    bubble.appendChild(timeEl);
    if (pending) bubble.dataset.pending = 'true';
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (!outbound && !panel.classList.contains('open')) {
      unreadCount += 1;
      renderUnread();
    }
    saveHistoryEntry({
      content,
      outbound,
      isHtml: Boolean(isHtml),
      timestamp: timestamp || Date.now(),
      sender: sender || '',
      sendDate: sendDate || '',
      id: id || '',
      key: key || ''
    });
    return bubble;
  }

  function getSenderName() {
    const name = (nameInput && nameInput.value.trim()) || chatState.sender || 'Guest';
    chatState.sender = name;
    saveState();
    return name;
  }

  function getSenderEmail() {
    const email = (emailInput && emailInput.value.trim()) || chatState.sender_email || 'guest@example.com';
    chatState.sender_email = email;
    saveState();
    return email;
  }

  function hydrateIdentity() {
    if (nameInput && chatState.sender) nameInput.value = chatState.sender;
    if (emailInput && chatState.sender_email) emailInput.value = chatState.sender_email;
  }

  async function createGuestRoom({ content, sender, senderEmail }) {
    const headers = window.withCsrf
      ? window.withCsrf({ 'Content-Type': 'application/json' })
      : { 'Content-Type': 'application/json' };
    const response = await fetch(endpoints.create, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        sender,
        sender_email: senderEmail,
        creation_date: ''
      })
    });

    const payload = await safeJson(response);
    const data = extractCreateResult(payload);

    chatState.room = data.room || chatState.room;
    chatState.respondent_user = data.respondent_user || chatState.respondent_user;
    chatState.token = data.token || chatState.token;
    saveState();

    if (!chatState.room) {
      throw new Error('Missing room from create response');
    }
  }

  async function sendMessage({ content, sender, senderEmail }) {
    if (!chatState.room) throw new Error('Missing room');

    const headers = window.withCsrf
      ? window.withCsrf({ 'Content-Type': 'application/json' })
      : { 'Content-Type': 'application/json' };
    const response = await fetch(endpoints.send, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        room: chatState.room,
        sender,
        sender_email: senderEmail,
        send_date: '',
        respondent_user: chatState.respondent_user || ''
      })
    });
    const payload = await safeJson(response);
    if (!response.ok || payload.error) {
      throw new Error(payload.error || 'Failed to send message');
    }
    return payload;
  }

  async function fetchMessages() {
    if (!chatState.room) return;
    const url = `${endpoints.messages}?room=${encodeURIComponent(chatState.room)}&_=${Date.now()}`;
    const response = await fetch(url, { method: 'GET' });
    const payload = await safeJson(response);
    const data = payload.message || payload || {};
    const items = Array.isArray(data) ? data : data.messages || data.items || data.results || [];
    let sawInbound = false;

    items.forEach((item) => {
      const rawContent = item.content || item.message || item.text || '';
      const replyContent = normalizeRichText(rawContent);
      const cleaned = replyContent.isHtml ? replyContent.text : '';
      const content = replyContent.text;
      const id = item.name || item.id || item.creation || item.send_date || content;
      const key = buildMessageKey({
        sender: item.sender || item.owner || '',
        content,
        sendDate: item.send_date || item.creation || ''
      });
      if (reconcilePendingFromItem(item, content, item.send_date, key)) {
        if (id) seenMessageIds.add(id);
        if (key) seenMessageKeys.add(key);
        return;
      }
      const outbound = isOutbound(item);
      if (!outbound) {
        agentActive = true;
      }
      if (!outbound) sawInbound = true;
      appendMessage({
        content,
        outbound,
        id,
        isHtml: Boolean(cleaned),
        key,
        timestamp: parseSendDate(item.send_date) || Date.now(),
        sender: item.sender || item.owner || '',
        sendDate: item.send_date || item.creation || ''
      });
    });

    if (sawInbound) {
      hideTypingIndicator();
    }
  }


  function appendBotMessage(text, options = {}) {
    const bubble = document.createElement('div');
    bubble.className = 'chatbot-message inbound chatbot-message-bot';
    if (options.isHtml) {
      const sanitized = sanitizeHtml(text);
      bubble.innerHTML = sanitized || formatMessage(stripHtml(text));
    } else {
      bubble.innerHTML = formatMessage(text);
    }
    const timeEl = document.createElement('div');
    timeEl.className = 'chatbot-message-time';
    timeEl.textContent = formatTimestamp(Date.now());

    let storedButtons = null;
    if (options.buttons && options.buttons.length) {
      storedButtons = options.buttons.map((button) => ({
        label: button.label,
        action: button.action || '',
        value: button.value || ''
      }));
      const actions = document.createElement('div');
      actions.className = 'chatbot-actions';
      options.buttons.forEach((button) => {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'chatbot-action';
        action.textContent = button.label;
        action.dataset.action = button.action || '';
        action.dataset.value = button.value || '';
        action.addEventListener('click', () => {
          if (actions.dataset.disabled === 'true') return;
          disableActionButtons(actions);
          handleAction(button);
        });
        actions.appendChild(action);
      });
      bubble.appendChild(actions);
    }

    bubble.appendChild(timeEl);
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    saveHistoryEntry({
      content: text,
      outbound: false,
      isHtml: Boolean(options.isHtml),
      buttons: storedButtons,
      timestamp: Date.now()
    });
  }

  function disableActionButtons(container) {
    if (!container) return;
    if (container.dataset.disabled === 'true') return;
    container.dataset.disabled = 'true';
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.style.pointerEvents = 'none';
    });
    container.classList.add('disabled');
  }

  function showGreeting() {
    if (greetingShown) return;
    if (!panel.classList.contains('open')) return;
    if (handoffEnabled || agentActive) return;
    if (messagesEl && messagesEl.children.length > 0) return;
    greetingShown = true;
    appendBotMessage(dynamicGreeting || 'Hi! Welcome to QC & MC. How can I help you today?');
  }

  function handleAction(button) {
    const action = button.action;
    if (action === 'topic') {
      autoFlow.topic = button.value;
      autoFlow.stage = 'topic_selected';
      const topic = topics.find((item) => item.id === button.value);
      if (topic) {
        const replyContent = normalizeRichText(topic.reply);
        appendBotMessage(replyContent.text, { isHtml: replyContent.isHtml });
      }
      askResolution();
      return;
    }

    if (action === 'resolved_yes') {
      autoFlow.stage = 'done';
      appendBotMessage('Glad I could help. If you need anything else, just message again.');
      return;
    }

    if (action === 'resolved_no') {
      autoFlow.stage = 'agent_offer';
      appendBotMessage('Do you want to talk to an agent?', {
        buttons: [
          { label: 'Yes, talk to agent', action: 'agent_yes' },
          { label: 'No, thanks', action: 'agent_no' }
        ]
      });
      return;
    }

    if (action === 'agent_yes') {
      autoFlow.stage = 'handoff';
      handoffEnabled = true;
      appendBotMessage('Connecting you to an agent...');
      handoffToAgent();
      return;
    }

    if (action === 'agent_no') {
      autoFlow.stage = 'intro';
      autoFlow.topic = null;
      appendBotMessage('No problem. Pick a topic below or type a new question.', {
        buttons: topics.map((topic) => ({
          label: topic.label,
          action: 'topic',
          value: topic.id
        }))
      });
    }
  }

  function handleAutoFlow(content) {
    if (handoffEnabled || agentActive) return;
    if (autoFlow.stage === 'intro') {
      autoFlow.lastQuestion = content;
      showTopicPrompt();
      return;
    }

    if (autoFlow.stage === 'topic_selected') {
      autoFlow.lastQuestion = content;
      askResolution();
      return;
    }

    if (autoFlow.stage === 'agent_offer') {
      appendBotMessage('Please use the buttons so I can connect you properly.');
      return;
    }

    if (autoFlow.stage === 'done') {
      autoFlow.stage = 'intro';
      autoFlow.topic = null;
      appendBotMessage('Anything else I can help with?', {
        buttons: topics.map((topic) => ({
          label: topic.label,
          action: 'topic',
          value: topic.id
        }))
      });
    }
  }

  function showTopicPrompt() {
    appendBotMessage('Choose a topic so I can help faster:', {
      buttons: topics.map((topic) => ({
        label: topic.label,
        action: 'topic',
        value: topic.id
      }))
    });
  }

  function askResolution() {
    if (handoffEnabled || agentActive) return;
    appendBotMessage('Did this solve your issue?', {
      buttons: [
        { label: 'Yes', action: 'resolved_yes' },
        { label: 'No', action: 'resolved_no' }
      ]
    });
  }

  async function loadTopics() {
    try {
      const res = await fetch('/api/clefincode/bot-topics', { cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        const data = raw && raw.message ? raw.message : raw;
        const remoteTopics = data && Array.isArray(data.topics) ? data.topics : [];
        if (remoteTopics.length) {
          topics = remoteTopics.map((topic) => ({
            id: topic.id || topic.name || topic.label,
            label: topic.label || 'Topic',
            reply: topic.reply || ''
          }));
        }
        const greetingValue = data && (data.greeting || data.greetings || data.welcome_message);
        if (typeof greetingValue === 'string') {
          dynamicGreeting = greetingValue.trim();
        }
        return;
      }
    } catch (error) {
      // fall through to local JSON fallback
    }
    try {
      const res = await fetch('/static/data/chatbot_topics.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.topics) && data.topics.length) {
        topics = data.topics;
      }
      if (typeof data.greeting === 'string') {
        dynamicGreeting = data.greeting.trim();
      }
    } catch (error) {
      return;
    }
  }

  async function handoffToAgent() {
    try {
      if (!chatState.room) {
        const sender = getSenderName();
        const senderEmail = getSenderEmail();
        await createGuestRoom({
          content: autoFlow.lastQuestion || 'Guest requested an agent.',
          sender,
          senderEmail
        });
        startPolling();
      }

      const handoffMessage = [
        'Guest requested a live agent.',
        autoFlow.topic ? `Topic: ${autoFlow.topic}` : '',
        autoFlow.lastQuestion ? `Question: ${autoFlow.lastQuestion}` : ''
      ].filter(Boolean).join(' ');

      try {
        await sendMessage({
          content: handoffMessage,
          sender: getSenderName(),
          senderEmail: getSenderEmail()
        });
      } catch (error) {
        chatState.room = null;
        chatState.respondent_user = null;
        saveState();
        const sender = getSenderName();
        const senderEmail = getSenderEmail();
        await createGuestRoom({
          content: autoFlow.lastQuestion || 'Guest requested an agent.',
          sender,
          senderEmail
        });
        startPolling();
        await sendMessage({
          content: handoffMessage,
          sender,
          senderEmail
        });
      }
    } catch (error) {
      appendBotMessage('Unable to connect to an agent right now. Please try again later.');
      handoffEnabled = false;
      autoFlow.stage = 'intro';
    }
  }

  function isOutbound(item) {
    if (!item) return false;
    const sender = (item.sender || item.owner || '').toLowerCase();
    const localSender = (chatState.sender || 'guest').toLowerCase();
    return sender === localSender;
  }

  function stripHtml(value) {
    if (!value) return '';
    if (typeof value !== 'string') return String(value);
    const temp = document.createElement('div');
    temp.innerHTML = value;
    return (temp.textContent || temp.innerText || '').trim();
  }

  function escapeHtml(value) {
    if (!value) return '';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatMessage(text) {
    const escaped = escapeHtml(text);
    const withLinks = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    return withLinks.replace(/\n/g, '<br>');
  }

  function decodeHtml(value) {
    if (!value || typeof value !== 'string') return '';
    const temp = document.createElement('div');
    temp.innerHTML = value;
    return temp.textContent || temp.innerText || '';
  }

  function normalizeRichText(value) {
    if (!value || typeof value !== 'string') {
      return { text: String(value || ''), isHtml: false };
    }
    const decoded = decodeHtml(value);
    const cleanedDecoded = sanitizeHtml(decoded);
    if (cleanedDecoded) {
      return { text: cleanedDecoded, isHtml: true };
    }
    const cleanedRaw = sanitizeHtml(value);
    if (cleanedRaw) {
      return { text: cleanedRaw, isHtml: true };
    }
    return { text: stripHtml(decoded || value), isHtml: false };
  }

  function loadHistory() {
    try {
      const raw = window.sessionStorage.getItem(historyKey);
      if (!raw) return;
      const entries = JSON.parse(raw);
      if (!Array.isArray(entries)) return;
      const seenKeys = new Set();
      isRestoring = true;
      entries.forEach((entry) => {
        const entryKey = buildHistoryKey(entry);
        if (seenKeys.has(entryKey)) return;
        seenKeys.add(entryKey);
        if (entry.id) seenMessageIds.add(entry.id);
        if (entry.key) seenMessageKeys.add(entry.key);
        if (!entry.key && entry.outbound) {
          const sender = entry.sender || chatState.sender || 'guest';
          const key = buildMessageKey({
            sender,
            content: entry.content || '',
            sendDate: entry.sendDate || entry.timestamp || ''
          });
          seenMessageKeys.add(key);
        }
        if (entry.outbound) {
          appendMessage({
            content: entry.content || '',
            outbound: true,
            isHtml: Boolean(entry.isHtml),
            timestamp: entry.timestamp || Date.now(),
            sender: entry.sender || chatState.sender || '',
            sendDate: entry.sendDate || entry.timestamp || ''
          });
        } else {
          appendBotMessage(entry.content || '', {
            isHtml: Boolean(entry.isHtml),
            buttons: Array.isArray(entry.buttons) ? entry.buttons : []
          });
        }
      });
      isRestoring = false;
      if (entries.length > 0) {
        greetingShown = true;
      }
    } catch (error) {
      isRestoring = false;
      return;
    }
  }

  function saveHistoryEntry(entry) {
    try {
      if (isRestoring) return;
      const raw = window.sessionStorage.getItem(historyKey);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return;
      const last = list[list.length - 1];
      if (last && buildHistoryKey(last) === buildHistoryKey(entry)) {
        return;
      }
      list.push(entry);
      if (list.length > maxHistory) {
        list.splice(0, list.length - maxHistory);
      }
      window.sessionStorage.setItem(historyKey, JSON.stringify(list));
    } catch (error) {
      return;
    }
  }

  function buildHistoryKey(entry) {
    if (!entry) return '';
    const buttons = Array.isArray(entry.buttons) ? JSON.stringify(entry.buttons) : '';
    const ts = entry.timestamp || '';
    return `${entry.outbound ? 'out' : 'in'}::${entry.content || ''}::${entry.isHtml ? 'html' : 'txt'}::${buttons}::${ts}`;
  }

  function initIdlePrompt() {
    if (idlePromptReady) return;
    if (!isVerified()) return;
    idlePromptReady = true;
    const idleMs = 2 * 60 * 1000;
    let idleTimer = null;
    let promptShown = false;

    const resetIdle = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(showIdlePrompt, idleMs);
    };

    const showIdlePrompt = () => {
      if (promptShown) return;
      promptShown = true;
      appendBotMessage('Continue chatting with agent?', {
        buttons: [
          { label: 'Yes', action: 'idle_yes' },
          { label: 'No', action: 'idle_no' }
        ]
      });
    };

    const markActive = () => {
      promptShown = false;
      resetIdle();
    };

    document.addEventListener('click', markActive);
    document.addEventListener('keydown', markActive);
    resetIdle();

    const originalHandleAction = handleAction;
    handleAction = (button) => {
      if (button.action === 'idle_yes') {
        promptShown = false;
        if (agentActive || handoffEnabled || chatState.room) {
          appendBotMessage('Continuing chatting with agent.');
          resetIdle();
          return;
        }
        appendBotMessage('Continuing chatting.');
        resetIdle();
        return;
      }
      if (button.action === 'idle_no') {
        promptShown = false;
        appendBotMessage('Chat Ended.');
        clearAllHistory();
        stopPolling();
        chatState = {};
        handoffEnabled = false;
        agentActive = false;
        pendingOutbound.length = 0;
        seenMessageIds.clear();
        seenMessageKeys.clear();
        greetingShown = false;
        autoFlow.stage = 'intro';
        autoFlow.topic = null;
        autoFlow.lastQuestion = '';
        messagesEl.innerHTML = '';
        showGreeting();
        resetIdle();
        return;
      }
      originalHandleAction(button);
    };
  }

  function clearAllHistory() {
    try {
      window.localStorage.removeItem(historyKey);
      window.localStorage.removeItem(storageKey);
      window.sessionStorage.removeItem(historyKey);
      window.sessionStorage.removeItem(initKey);
    } catch (error) {
      return;
    }
  }

  function sanitizeHtml(value) {
    if (!value || typeof value !== 'string') return '';
    if (!/[<>]/.test(value)) return '';

    const allowedTags = new Set(['A', 'BR', 'P', 'B', 'STRONG', 'EM', 'I', 'UL', 'OL', 'LI', 'DIV']);
    const template = document.createElement('template');
    template.innerHTML = value;

    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toUpperCase();
          if (!allowedTags.has(tag)) {
            const text = document.createTextNode(child.textContent || '');
            child.replaceWith(text);
            return;
          }

          if (tag === 'DIV') {
            const fragment = document.createDocumentFragment();
            while (child.firstChild) {
              fragment.appendChild(child.firstChild);
            }
            child.replaceWith(fragment);
            return;
          }

          if (tag === 'A') {
            const href = child.getAttribute('href') || '';
            if (!href.startsWith('http://') && !href.startsWith('https://')) {
              child.replaceWith(document.createTextNode(child.textContent || ''));
              return;
            }
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener');
          } else {
            Array.from(child.attributes).forEach((attr) => child.removeAttribute(attr.name));
          }

          walk(child);
        } else if (child.nodeType === Node.TEXT_NODE) {
          return;
        } else {
          child.remove();
        }
      });
    };

    walk(template.content);
    return template.innerHTML.trim();
  }

  function reconcileOutbound(content, sendDate, key) {
    if (!content) return false;
    if (!pendingOutbound.length) return false;
    const sentAt = parseSendDate(sendDate);
    const index = pendingOutbound.findIndex((entry) => {
      if (entry.content !== content) return false;
      if (!sentAt) return true;
      return Math.abs(sentAt - entry.at) < 15000;
    });
    if (index === -1) return false;
    const [removed] = pendingOutbound.splice(index, 1);
    if (removed && removed.key) seenMessageKeys.add(removed.key);
    if (removed && removed.el) {
      removed.el.dataset.pending = 'false';
      const timeEl = removed.el.querySelector('.chatbot-message-time');
      if (timeEl) timeEl.textContent = formatTimestamp(sentAt || Date.now());
    }
    return true;
  }

  function reconcilePendingFromItem(item, content, sendDate, key) {
    const senderEmail = (item.sender_email || '').toLowerCase();
    const localEmail = (chatState.sender_email || '').toLowerCase();
    const senderName = (item.sender || '').toLowerCase();
    const localName = (chatState.sender || '').toLowerCase();

    const matchesSender = (senderEmail && localEmail && senderEmail === localEmail) ||
      (senderName && localName && senderName === localName) ||
      (senderName === 'guest' && localName === 'guest');

    if (!matchesSender) return false;
    return reconcileOutbound(content, sendDate, key);
  }

  function isRecentDuplicate(content) {
    if (!content) return false;
    const recent = Array.from(messagesEl.querySelectorAll('.chatbot-message.outbound')).slice(-3);
    return recent.some((node) => (node.textContent || '').trim() === content);
  }

  function parseSendDate(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.replace(' ', 'T');
    const normalized = trimmed.replace(/\.\d+/, (match) => {
      const ms = match.slice(1, 4).padEnd(3, '0');
      return `.${ms}`;
    });
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  function formatTimestamp(value) {
    if (!value) return '';
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function buildMessageKey({ sender, content, sendDate }) {
    const senderKey = (sender || '').toLowerCase();
    const contentKey = (content || '').trim();
    const timeKey = typeof sendDate === 'number'
      ? sendDate
      : (sendDate || '');
    return `${senderKey}::${contentKey}::${timeKey}`;
  }


  function showTypingIndicator(text) {
    if (!typingIndicator) return;
    if (typingText && text) typingText.textContent = text;
    typingIndicator.classList.add('show');
    typingIndicator.setAttribute('aria-hidden', 'false');
    if (typingTimeoutId) window.clearTimeout(typingTimeoutId);
    typingTimeoutId = window.setTimeout(() => {
      hideTypingIndicator();
    }, 3000);
  }

  function hideTypingIndicator() {
    if (!typingIndicator) return;
    typingIndicator.classList.remove('show');
    typingIndicator.setAttribute('aria-hidden', 'true');
    if (typingTimeoutId) {
      window.clearTimeout(typingTimeoutId);
      typingTimeoutId = null;
    }
  }

  function renderUnread() {
    if (!unreadBadge) return;
    if (unreadCount > 0) {
      unreadBadge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
      unreadBadge.classList.add('show');
    } else {
      unreadBadge.textContent = '0';
      unreadBadge.classList.remove('show');
    }
  }

  function clearUnread() {
    unreadCount = 0;
    renderUnread();
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(chatState));
    } catch (error) {
      return;
    }
  }

  function extractCreateResult(payload) {
    if (!payload) return {};
    if (payload.message && Array.isArray(payload.message.results) && payload.message.results[0]) {
      return payload.message.results[0];
    }
    if (Array.isArray(payload.results) && payload.results[0]) {
      return payload.results[0];
    }
    if (payload.message && payload.message.room) {
      return payload.message;
    }
    return payload;
  }
})();
